"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/editorFetch";
import { CsvTableEditor } from "./CsvTableEditor";
import { MarkdownEditor } from "./MarkdownEditor";
import { PlainTextEditor } from "./PlainTextEditor";

/**
 * Editor Session (data-model.md): the state of whichever file is currently
 * open in the browser. Exists only in the browser; never persisted until a
 * save (PUT /api/file) succeeds.
 */
export interface EditorSession {
  path: string;
  loadedContent: string;
  currentContent: string;
  kind: "markdown" | "text" | "csv";
  saveState: "idle" | "saving" | "error";
  saveError: string | null;
}

export function deriveKind(path: string): EditorSession["kind"] {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".csv")) return "csv";
  return "text";
}

export interface FileEditorProps {
  path: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; session: EditorSession };

export function FileEditor({ path, onDirtyChange }: FileEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  // Markdown/CSV files open showing the rendered view by default; "Edit"/"Raw"
  // is an explicit switch, never shown side-by-side with the preview/table.
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  // Load the file whenever a different path is opened (US1, FR-002).
  useEffect(() => {
    setMode("preview");

    if (!path) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    authedFetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 422) {
          setState({ status: "unsupported", message: data.message });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: data.message ?? "Failed to load file" });
          return;
        }

        setState({
          status: "ready",
          session: {
            path,
            loadedContent: data.content,
            currentContent: data.content,
            kind: deriveKind(path),
            saveState: "idle",
            saveError: null,
          },
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const dirty = state.status === "ready" && state.session.currentContent !== state.session.loadedContent;

  // Report dirty state up so page.tsx can guard switching files (FR-009).
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Warn on tab close/reload while dirty (FR-009, research.md §7).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function handleContentChange(value: string) {
    setState((prev) =>
      prev.status === "ready" ? { ...prev, session: { ...prev.session, currentContent: value } } : prev,
    );
  }

  async function handleSave() {
    if (state.status !== "ready") return;
    const { path: currentPath, currentContent } = state.session;

    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, session: { ...prev.session, saveState: "saving", saveError: null } }
        : prev,
    );

    try {
      const res = await authedFetch("/api/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, content: currentContent }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Save failed: keep currentContent untouched, surface the error (FR-010).
        setState((prev) =>
          prev.status === "ready"
            ? { ...prev, session: { ...prev.session, saveState: "error", saveError: data.message ?? "Save failed" } }
            : prev,
        );
        return;
      }

      // Save succeeded: loadedContent catches up, dirty clears (FR-005, FR-008).
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              session: { ...prev.session, loadedContent: currentContent, saveState: "idle", saveError: null },
            }
          : prev,
      );
    } catch (err) {
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, session: { ...prev.session, saveState: "error", saveError: (err as Error).message } }
          : prev,
      );
    }
  }

  if (!path || state.status === "idle") {
    return <p style={{ color: "#888" }}>Select a file to view its content.</p>;
  }
  if (state.status === "loading") {
    return <p style={{ color: "#888" }}>Loading &quot;{path}&quot;…</p>;
  }
  if (state.status === "unsupported") {
    return <p style={{ color: "#888" }}>{state.message}</p>;
  }
  if (state.status === "error") {
    return <p style={{ color: "crimson" }}>{state.message}</p>;
  }

  const { session } = state;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, overflowWrap: "anywhere" }}>{session.path}</h3>
        {(session.kind === "markdown" || session.kind === "csv") && (
          <div style={{ display: "inline-flex", border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setMode("preview")}
              style={{
                padding: "6px 12px",
                border: "none",
                background: mode === "preview" ? "#eee" : "#fff",
                fontWeight: mode === "preview" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {session.kind === "csv" ? "Table" : "Preview"}
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderLeft: "1px solid #ddd",
                background: mode === "edit" ? "#eee" : "#fff",
                fontWeight: mode === "edit" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {session.kind === "csv" ? "Raw" : "Edit"}
            </button>
          </div>
        )}
        {dirty && <span style={{ color: "#b8860b" }}>● unsaved changes</span>}
        <button onClick={handleSave} disabled={session.saveState === "saving" || !dirty}>
          {session.saveState === "saving" ? "Saving…" : "Save"}
        </button>
        {session.saveState === "idle" && !dirty && session.loadedContent !== "" && (
          <span style={{ color: "#2e7d32" }}>Saved</span>
        )}
      </div>
      {session.saveState === "error" && (
        <p style={{ color: "crimson" }}>Save failed: {session.saveError}</p>
      )}
      {session.kind === "markdown" ? (
        <MarkdownEditor value={session.currentContent} onChange={handleContentChange} mode={mode} />
      ) : session.kind === "csv" ? (
        <CsvTableEditor
          value={session.currentContent}
          onChange={handleContentChange}
          mode={mode === "preview" ? "table" : "raw"}
        />
      ) : (
        <PlainTextEditor value={session.currentContent} onChange={handleContentChange} />
      )}
    </div>
  );
}
