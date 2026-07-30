"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import useSWR from "swr";
import { authedFetch } from "@/lib/editorFetch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  ChevronIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  KebabIcon,
  NewFileIcon,
  NewFolderIcon,
  TrashIcon,
  UploadIcon,
} from "./Icons";

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
  /** Called with a folder's path whenever the user clicks a folder row (in
   * addition to that folder locally toggling expand/collapse), so the URL
   * can reflect folders being browsed too, not just files (spec 018 FR-004). */
  onSelectFolder?: (path: string) => void;
  /** Called with a file's path after it's successfully deleted, so the
   * caller can close it if it was open in the editor (FR-003, research.md §3). */
  onFileDeleted?: (path: string) => void;
  /** Called with a folder's path after it's successfully deleted, so the
   * caller can close the editor if it had a file open from inside it. */
  onFolderDeleted?: (path: string) => void;
  /** When set, every ancestor folder of this path auto-expands (in addition
   * to the always-expanded root), so a deep-linked file is visible without
   * the user manually opening each folder (spec 018 FR-003, research.md §4). */
  expandToPath?: string | null;
  dict: Dictionary["editor"]["tree"];
}

/** True when `ancestorPath` is `targetPath` itself or one of its containing folders. */
function isAncestorOf(ancestorPath: string, targetPath: string): boolean {
  return ancestorPath === targetPath || targetPath.startsWith(`${ancestorPath}/`);
}

/** Root of the browsable tree (FR-001). Lazily fetches each directory's
 * contents from GET /api/tree as it's expanded (research.md §2). */
export function FileTree({
  onSelectFile,
  onSelectFolder,
  onFileDeleted,
  onFolderDeleted,
  expandToPath,
  dict,
}: FileTreeProps) {
  return (
    <DirectoryNode
      path=""
      label="/"
      depth={0}
      onSelectFile={onSelectFile}
      onSelectFolder={onSelectFolder}
      onFileDeleted={onFileDeleted}
      onFolderDeleted={onFolderDeleted}
      expandToPath={expandToPath}
      defaultExpanded
      dict={dict}
    />
  );
}

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments[segments.length - 1] || path;
}

/** Joins a directory path (possibly already trailing-slash-terminated, as
 * returned by S3 CommonPrefixes) with a child name, without producing a
 * double slash. */
function joinPath(dirPath: string, name: string): string {
  const trimmed = dirPath.replace(/\/+$/, "");
  return trimmed === "" ? name : `${trimmed}/${name}`;
}

function isMarkdownFile(name: string): boolean {
  return name.toLowerCase().endsWith(".md");
}

/** Prompts for a new file/folder name, rejecting path separators and
 * treating a blank or cancelled entry as "nothing to create" (FR-007).
 * Shared by the New file (US2) and New folder (US3) actions. */
function promptForEntryName(promptMessage: string, dict: Dictionary["editor"]["tree"]): string | null {
  const raw = window.prompt(promptMessage);
  if (raw === null) return null;

  const name = raw.trim();
  if (name === "") return null;

  if (name.includes("/")) {
    window.alert(dict.invalidName(name));
    return null;
  }

  return name;
}

const kebabButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#666",
  cursor: "pointer",
  borderRadius: 6,
  flexShrink: 0,
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 2,
  minWidth: 180,
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  zIndex: 40,
  padding: 4,
  display: "flex",
  flexDirection: "column",
};

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  border: "none",
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
  borderRadius: 6,
  fontSize: 14,
};

const labelStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

interface MenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

/** A single "more actions" (⋮) control per row, revealing file/folder
 * operations only on demand instead of showing every icon on every row at
 * once — keeps rows readable and works the same by touch or by mouse. */
function RowMenu({
  items,
  disabled,
  moreActionsLabel,
}: {
  items: MenuItem[];
  disabled?: boolean;
  moreActionsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        title={moreActionsLabel}
        aria-label={moreActionsLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        style={kebabButtonStyle}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <KebabIcon />
      </button>
      {open && (
        <div role="menu" style={menuStyle}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              style={{ ...menuItemStyle, color: item.destructive ? "#c0392b" : "#222" }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectoryNode({
  path,
  label,
  depth,
  onSelectFile,
  onSelectFolder,
  onFileDeleted,
  onFolderDeleted,
  onDeleted,
  expandToPath,
  defaultExpanded,
  dict,
}: {
  path: string;
  label: string;
  depth: number;
  onSelectFile: (p: string) => void;
  onSelectFolder?: (p: string) => void;
  onFileDeleted?: (path: string) => void;
  onFolderDeleted?: (path: string) => void;
  /** Invoked after this node itself is successfully deleted, so its parent
   * can refresh and drop it from the listing. Not set on the root node
   * (depth 0), which can't be deleted. */
  onDeleted?: () => void;
  /** See FileTreeProps.expandToPath — threaded down unchanged to every child. */
  expandToPath?: string | null;
  defaultExpanded?: boolean;
  dict: Dictionary["editor"]["tree"];
}) {
  const [expanded, setExpanded] = useState(
    Boolean(defaultExpanded) || (expandToPath ? isAncestorOf(path, expandToPath) : false),
  );
  const [busy, setBusy] = useState(false);

  const uploadFilesInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement>(null);

  // Fetches this directory's listing while expanded, and keeps it fresh via
  // the SWRConfig-wide refreshInterval/revalidateOnFocus (app/files/layout.tsx)
  // so changes made outside this tab (e.g. by an agent) show up in the
  // background — paused automatically while the tab is hidden (spec 019
  // research.md §1, FR-001, FR-003, FR-006).
  const {
    data: entries,
    error,
    isLoading: loading,
    mutate: refreshEntries,
  } = useSWR<TreeListing>(expanded ? `/api/tree?path=${encodeURIComponent(path)}` : null, async (url: string) => {
    const res = await authedFetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? dict.dirLoadFailed);
    return data as TreeListing;
  });

  async function handleUpload(fileList: FileList | null, mode: "files" | "folder") {
    if (!fileList || fileList.length === 0) return;

    const picked = Array.from(fileList);
    const mdFiles = picked.filter((f) => isMarkdownFile(f.name));
    const skippedCount = picked.length - mdFiles.length;

    if (mdFiles.length === 0) {
      window.alert(skippedCount > 0 ? dict.nothingToUploadFiltered(skippedCount) : dict.nothingToUpload);
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
      if (!window.confirm(dict.overwriteFilesConfirm(names))) {
        return;
      }
    }

    setBusy(true);
    try {
      const res = await authedFetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePath: path, files: batch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? dict.uploadFailedLabel);

      const results = data.results as UploadResult[];
      const uploaded = results.filter((r) => r.status === "uploaded").length;
      const failed = results.filter((r) => r.status === "failed");
      const skipped = results.filter((r) => r.status === "skipped").length + skippedCount;

      let summary = dict.uploadSummary(uploaded, skipped);
      if (failed.length > 0) {
        summary += dict.uploadSummaryFailedSuffix(failed.map((f) => `${f.path} (${f.message})`).join(", "));
      }
      window.alert(summary);

      setExpanded(true);
      await refreshEntries();
    } catch (err) {
      window.alert(dict.uploadFailed((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadFolder() {
    setBusy(true);
    try {
      const res = await authedFetch(`/api/download-zip?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: dict.downloadNothing }));
        window.alert(data.message ?? dict.downloadNothing);
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
      window.alert(dict.downloadFailed((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /** Deletes a file after confirmation (FR-001, FR-002). Refreshes this
   * directory's listing either way, since a failure may mean the file was
   * already removed elsewhere (Edge Cases). */
  async function handleDeleteFile(filePath: string) {
    if (!window.confirm(dict.deleteFileConfirm(baseName(filePath)))) return;

    setBusy(true);
    try {
      const res = await authedFetch(`/api/file?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? dict.deleteFailedLabel);

      onFileDeleted?.(filePath);
    } catch (err) {
      window.alert(dict.deleteFailed((err as Error).message));
    } finally {
      await refreshEntries();
      setBusy(false);
    }
  }

  /** Creates a new empty file by name in this directory, confirming first if
   * it would overwrite an existing file, then opens it in the editor
   * (FR-004, FR-006, FR-007, FR-010). */
  async function handleCreateFile() {
    const name = promptForEntryName(dict.promptNewFile, dict);
    if (!name) return;

    const targetPath = joinPath(path, name);

    const existingNames = new Set((entries?.files ?? []).map((f) => baseName(f.path)));
    if (existingNames.has(name) && !window.confirm(dict.overwriteFileConfirm(name))) {
      return;
    }

    setBusy(true);
    try {
      const res = await authedFetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, content: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? dict.createFailedLabel);

      setExpanded(true);
      await refreshEntries();
      onSelectFile(targetPath);
    } catch (err) {
      window.alert(dict.createFailed((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /** Deletes this folder and everything inside it, after confirmation.
   * Notifies the parent (via `onDeleted`) to refresh its listing, and the
   * top-level tree (via `onFolderDeleted`) so the editor can close a file
   * that was open from inside this folder. */
  async function handleDeleteFolder() {
    if (!window.confirm(dict.deleteFolderConfirm(label))) {
      return;
    }

    setBusy(true);
    try {
      const res = await authedFetch(`/api/directory?path=${encodeURIComponent(path)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? dict.deleteFailedLabel);

      onFolderDeleted?.(path);
      onDeleted?.();
    } catch (err) {
      window.alert(dict.deleteFailed((err as Error).message));
      setBusy(false);
    }
  }

  /** Creates a new subfolder by name in this directory (FR-005, FR-007).
   * Idempotent if the folder already exists; errors on a name collision
   * with an existing file. */
  async function handleCreateFolder() {
    const name = promptForEntryName(dict.promptNewFolder, dict);
    if (!name) return;

    const targetPath = joinPath(path, name);

    setBusy(true);
    try {
      const res = await authedFetch("/api/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? dict.createFailedLabel);

      setExpanded(true);
      await refreshEntries();
    } catch (err) {
      window.alert(dict.createFailed((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const menuItems: MenuItem[] = [
    { label: dict.menuNewFile, icon: <NewFileIcon />, onClick: handleCreateFile },
    { label: dict.menuNewFolder, icon: <NewFolderIcon />, onClick: handleCreateFolder },
    { label: dict.menuUploadFiles, icon: <UploadIcon />, onClick: () => uploadFilesInputRef.current?.click() },
    { label: dict.menuUploadFolder, icon: <UploadIcon />, onClick: () => uploadFolderInputRef.current?.click() },
    { label: dict.menuDownloadZip, icon: <DownloadIcon />, onClick: handleDownloadFolder },
    ...(depth > 0
      ? [{ label: dict.menuDeleteFolder, icon: <TrashIcon />, onClick: handleDeleteFolder, destructive: true }]
      : []),
  ];

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1, minWidth: 0 }}
          onClick={() => {
            setExpanded((e) => !e);
            if (path !== "") onSelectFolder?.(path);
          }}
        >
          <ChevronIcon expanded={expanded} />
          <FolderIcon />
          <span style={labelStyle}>{label}</span>
        </div>
        <RowMenu items={menuItems} disabled={busy} moreActionsLabel={dict.moreActions} />
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
          {loading && <div style={{ color: "#888" }}>{dict.loading}</div>}
          {error && <div style={{ color: "crimson" }}>{error.message}</div>}
          {entries && entries.directories.length === 0 && entries.files.length === 0 && (
            <div style={{ color: "#888", fontStyle: "italic", paddingLeft: 30 }}>{dict.empty}</div>
          )}
          {entries?.directories.map((d) => (
            <DirectoryNode
              key={d.path}
              path={d.path}
              label={baseName(d.path)}
              depth={depth + 1}
              onSelectFile={onSelectFile}
              onSelectFolder={onSelectFolder}
              onFileDeleted={onFileDeleted}
              onFolderDeleted={onFolderDeleted}
              onDeleted={refreshEntries}
              expandToPath={expandToPath}
              dict={dict}
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
              <span style={{ ...labelStyle, flex: 1, minWidth: 0 }}>{baseName(f.path)}</span>
              <RowMenu
                items={[
                  { label: dict.menuDelete, icon: <TrashIcon />, onClick: () => handleDeleteFile(f.path), destructive: true },
                ]}
                disabled={busy}
                moreActionsLabel={dict.moreActions}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
