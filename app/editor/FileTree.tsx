"use client";

import { useEffect, useState } from "react";
import { ChevronIcon, FileIcon, FolderIcon } from "./Icons";

interface TreeListing {
  files: Array<{ path: string; size: number; lastModified: string }>;
  directories: Array<{ path: string }>;
}

export interface FileTreeProps {
  onSelectFile: (path: string) => void;
}

/** Root of the browsable tree (FR-001). Lazily fetches each directory's
 * contents from GET /api/tree as it's expanded (research.md §2). */
export function FileTree({ onSelectFile }: FileTreeProps) {
  return (
    <DirectoryNode path="" label="/" depth={0} onSelectFile={onSelectFile} defaultExpanded />
  );
}

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments[segments.length - 1] || path;
}

function DirectoryNode({
  path,
  label,
  depth,
  onSelectFile,
  defaultExpanded,
}: {
  path: string;
  label: string;
  depth: number;
  onSelectFile: (p: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded));
  const [entries, setEntries] = useState<TreeListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || entries !== null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/tree?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to load directory");
        if (!cancelled) setEntries(data as TreeListing);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, entries, path]);

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronIcon expanded={expanded} />
        <FolderIcon />
        <span>{label}</span>
      </div>
      {expanded && (
        <div>
          {loading && <div style={{ color: "#888" }}>Loading…</div>}
          {error && <div style={{ color: "crimson" }}>{error}</div>}
          {entries && entries.directories.length === 0 && entries.files.length === 0 && (
            <div style={{ color: "#888", fontStyle: "italic", paddingLeft: 30 }}>(empty)</div>
          )}
          {entries?.directories.map((d) => (
            <DirectoryNode
              key={d.path}
              path={d.path}
              label={baseName(d.path)}
              depth={depth + 1}
              onSelectFile={onSelectFile}
            />
          ))}
          {entries?.files.map((f) => (
            <div
              key={f.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                paddingLeft: 30,
              }}
              onClick={() => onSelectFile(f.path)}
            >
              <FileIcon />
              <span>{baseName(f.path)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
