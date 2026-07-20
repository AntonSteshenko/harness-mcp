"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon, DownloadIcon, FileIcon, FolderIcon, UploadIcon } from "./Icons";

interface TreeListing {
  files: Array<{ path: string; size: number; lastModified: string }>;
  directories: Array<{ path: string }>;
}

interface UploadResult {
  path: string;
  status: "uploaded" | "skipped" | "failed";
  message?: string;
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

function isMarkdownFile(name: string): boolean {
  return name.toLowerCase().endsWith(".md");
}

const iconButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#666",
  cursor: "pointer",
  borderRadius: 3,
};

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
  const [busy, setBusy] = useState(false);

  const uploadFilesInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement>(null);

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

  /** Re-fetches this directory's listing after an upload, so newly created
   * files appear without a full page reload (FR-005). Best-effort: on
   * failure the previously-shown listing is left as-is. */
  async function refreshEntries() {
    try {
      const res = await fetch(`/api/tree?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) setEntries(data as TreeListing);
    } catch {
      // best-effort refresh only
    }
  }

  async function handleUpload(fileList: FileList | null, mode: "files" | "folder") {
    if (!fileList || fileList.length === 0) return;

    const picked = Array.from(fileList);
    const mdFiles = picked.filter((f) => isMarkdownFile(f.name));
    const skippedCount = picked.length - mdFiles.length;

    if (mdFiles.length === 0) {
      window.alert(
        skippedCount > 0
          ? `Nothing to upload — none of the ${skippedCount} selected file(s) are Markdown (.md) files.`
          : "Nothing to upload.",
      );
      return;
    }

    const batch = await Promise.all(
      mdFiles.map(async (file) => ({
        relativePath: mode === "folder" ? file.webkitRelativePath || file.name : file.name,
        content: await file.text(),
      })),
    );

    // Only top-level filenames are checked, since this directory's cached
    // listing has no visibility into nested subfolders a folder upload
    // might target (research.md §5).
    const existingNames = new Set((entries?.files ?? []).map((f) => baseName(f.path)));
    const conflicts = batch.filter((f) => !f.relativePath.includes("/") && existingNames.has(f.relativePath));
    if (conflicts.length > 0) {
      const names = conflicts.map((f) => f.relativePath).join(", ");
      if (!window.confirm(`This will overwrite existing file(s): ${names}. Continue?`)) {
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePath: path, files: batch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Upload failed");

      const results = data.results as UploadResult[];
      const uploaded = results.filter((r) => r.status === "uploaded").length;
      const failed = results.filter((r) => r.status === "failed");
      const skipped = results.filter((r) => r.status === "skipped").length + skippedCount;

      let summary = `Uploaded ${uploaded} file(s), skipped ${skipped}.`;
      if (failed.length > 0) {
        summary += ` Failed: ${failed.map((f) => `${f.path} (${f.message})`).join(", ")}`;
      }
      window.alert(summary);

      setExpanded(true);
      await refreshEntries();
    } catch (err) {
      window.alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadFolder() {
    setBusy(true);
    try {
      const res = await fetch(`/api/download-zip?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Download failed" }));
        window.alert(data.message ?? "Nothing to download.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${path === "" ? "root" : baseName(path)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`Download failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1, minWidth: 0 }}
          onClick={() => setExpanded((e) => !e)}
        >
          <ChevronIcon expanded={expanded} />
          <FolderIcon />
          <span>{label}</span>
        </div>
        <button
          type="button"
          title="Upload files"
          disabled={busy}
          style={iconButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            uploadFilesInputRef.current?.click();
          }}
        >
          <UploadIcon />
        </button>
        <button
          type="button"
          title="Upload folder"
          disabled={busy}
          style={{ ...iconButtonStyle, fontSize: 9 }}
          onClick={(e) => {
            e.stopPropagation();
            uploadFolderInputRef.current?.click();
          }}
        >
          <UploadIcon />/
        </button>
        <button
          type="button"
          title="Download folder as zip"
          disabled={busy}
          style={iconButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadFolder();
          }}
        >
          <DownloadIcon />
        </button>
        <input
          ref={uploadFilesInputRef}
          type="file"
          accept=".md"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            handleUpload(e.target.files, "files");
            e.target.value = "";
          }}
        />
        <input
          ref={uploadFolderInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          {...({ webkitdirectory: "" } as Record<string, string>)}
          onChange={(e) => {
            handleUpload(e.target.files, "folder");
            e.target.value = "";
          }}
        />
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
