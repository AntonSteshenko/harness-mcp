"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { authedFetch } from "@/lib/editorFetch";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CsvTableEditor } from "./CsvTableEditor";
import { ExternalChangeBanner } from "./ExternalChangeBanner";
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
  /** ETag of the version reflected in `loadedContent` (spec 019 data-model.md). */
  loadedEtag: string;
  /** Set when the background metadata poll detects a newer ETag on the
   * server while the user has unsaved edits — never applied automatically,
   * only surfaced via ExternalChangeBanner (spec 019 US2, FR-005). */
  externalChange: { etag: string; dismissed: boolean } | null;
}

type FileFetchResult =
  | { kind: "unsupported"; message: string }
  | { kind: "folder"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; content: string; etag: string };

export function deriveKind(path: string): EditorSession["kind"] {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".csv")) return "csv";
  return "text";
}

export interface FileEditorProps {
  path: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  dict: Dictionary["editor"]["file"];
  csvDict: Dictionary["editor"]["csv"];
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unsupported"; message: string }
  | { status: "folder"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; session: EditorSession };

export function FileEditor({ path, onDirtyChange, dict, csvDict }: FileEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  // Markdown/CSV files open showing the rendered view by default; "Edit"/"Raw"
  // is an explicit switch, never shown side-by-side with the preview/table.
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  // Full content — loaded once per path, never polled on a timer (FR-010):
  // it's only revalidated by an explicit mutate() call below, triggered by
  // the etag poll noticing a real change, or by the user's own "reload
  // external version" action (spec 019 research.md §1, §2).
  const {
    data: contentData,
    error: contentError,
    isLoading: contentLoading,
    mutate: mutateContent,
  } = useSWR<FileFetchResult>(
    path ? `/api/file?path=${encodeURIComponent(path)}` : null,
    async (url: string) => {
      const res = await authedFetch(url);
      const data = await res.json();
      const filePath = new URL(url, window.location.origin).searchParams.get("path") ?? "";

      if (res.status === 422) return { kind: "unsupported", message: data.message };
      if (!res.ok && data.code === "type_mismatch") return { kind: "folder", message: dict.openedPathIsFolder(filePath) };
      if (!res.ok) return { kind: "error", message: data.message ?? dict.loadFailed };
      return { kind: "ready", content: data.content, etag: data.etag };
    },
    { refreshInterval: 0, revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  // Cheap ETag poll for the open file — inherits the shared
  // refreshInterval/revalidateOnFocus from SWRConfig (app/files/layout.tsx),
  // so it pauses while the tab is hidden just like the tree (FR-002, FR-006).
  const { data: polledEtag } = useSWR(
    path ? (["file-etag", path] as const) : null,
    async ([, filePath]: readonly [string, string]) => {
      const res = await authedFetch(`/api/file?path=${encodeURIComponent(filePath)}`, { method: "HEAD" });
      return res.ok ? res.headers.get("etag") : null;
    },
  );

  // Reset to idle when no file is open; transition into "ready" (and every
  // other terminal state) the first time this path's content arrives. Once
  // `state.session.path === path`, further contentData changes are handled
  // by the conflict-detection effect and the reload/save handlers below —
  // not here — so a background revalidation never blindly overwrites
  // in-progress edits (data-model.md).
  useEffect(() => {
    setMode("preview");

    if (!path) {
      setState({ status: "idle" });
      return;
    }
    if (state.status === "ready" && state.session.path === path) return;

    if (contentLoading) {
      setState({ status: "loading" });
      return;
    }
    if (contentError) {
      setState({ status: "error", message: contentError.message });
      return;
    }
    if (!contentData) return;

    if (contentData.kind !== "ready") {
      setState({ status: contentData.kind, message: contentData.message });
      return;
    }

    setState({
      status: "ready",
      session: {
        path,
        loadedContent: contentData.content,
        currentContent: contentData.content,
        kind: deriveKind(path),
        saveState: "idle",
        saveError: null,
        loadedEtag: contentData.etag,
        externalChange: null,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, contentData, contentError, contentLoading]);

  // Reacts to a new ETag from the poll above: silently adopt it if there are
  // no unsaved edits, otherwise surface the non-blocking conflict banner
  // without touching the user's edits (spec 019 US2, FR-004, FR-005,
  // data-model.md state transitions).
  useEffect(() => {
    if (state.status !== "ready" || !polledEtag || polledEtag === state.session.loadedEtag) return;

    const isDirty = state.session.currentContent !== state.session.loadedContent;
    if (!isDirty) {
      mutateContent().then((result) => {
        if (result?.kind !== "ready") return;
        setState((prev) =>
          prev.status === "ready"
            ? {
                ...prev,
                session: {
                  ...prev.session,
                  loadedContent: result.content,
                  currentContent: result.content,
                  loadedEtag: result.etag,
                  externalChange: null,
                },
              }
            : prev,
        );
      });
    } else {
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, session: { ...prev.session, externalChange: { etag: polledEtag, dismissed: false } } }
          : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polledEtag]);

  async function handleReloadExternal() {
    const result = await mutateContent();
    if (result?.kind !== "ready") return;
    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            session: {
              ...prev.session,
              loadedContent: result.content,
              currentContent: result.content,
              loadedEtag: result.etag,
              externalChange: null,
            },
          }
        : prev,
    );
  }

  function handleKeepMine() {
    setState((prev) =>
      prev.status === "ready" && prev.session.externalChange
        ? { ...prev, session: { ...prev.session, externalChange: { ...prev.session.externalChange, dismissed: true } } }
        : prev,
    );
  }

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
            ? { ...prev, session: { ...prev.session, saveState: "error", saveError: data.message ?? dict.saveFailedLabel } }
            : prev,
        );
        return;
      }

      // Save succeeded: loadedContent/loadedEtag catch up, dirty clears, and
      // this resolves any pending external-change conflict by overwriting
      // the external version (FR-005, FR-008, US2 Acceptance Scenario 4).
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              session: {
                ...prev.session,
                loadedContent: currentContent,
                loadedEtag: data.etag,
                externalChange: null,
                saveState: "idle",
                saveError: null,
              },
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
    return <p style={{ color: "#888" }}>{dict.selectPrompt}</p>;
  }
  if (state.status === "loading") {
    return <p style={{ color: "#888" }}>{dict.loading(path)}</p>;
  }
  if (state.status === "unsupported") {
    return (
      <div>
        <p style={{ color: "#888" }}>{state.message}</p>
        <a
          href={`/api/file/download?path=${encodeURIComponent(path)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {dict.openOrDownload}
        </a>
      </div>
    );
  }
  if (state.status === "folder") {
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
              {session.kind === "csv" ? dict.table : dict.preview}
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
              {session.kind === "csv" ? dict.raw : dict.edit}
            </button>
          </div>
        )}
        {dirty && <span style={{ color: "#b8860b" }}>{dict.unsavedChanges}</span>}
        <button onClick={handleSave} disabled={session.saveState === "saving" || !dirty}>
          {session.saveState === "saving" ? dict.saving : dict.save}
        </button>
        {session.saveState === "idle" && !dirty && session.loadedContent !== "" && (
          <span style={{ color: "#2e7d32" }}>{dict.saved}</span>
        )}
      </div>
      {session.saveState === "error" && (
        <p style={{ color: "crimson" }}>{dict.saveFailed(session.saveError ?? "")}</p>
      )}
      {session.externalChange && !session.externalChange.dismissed && (
        <ExternalChangeBanner onReload={handleReloadExternal} onKeepMine={handleKeepMine} dict={dict} />
      )}
      {session.kind === "markdown" ? (
        <MarkdownEditor value={session.currentContent} onChange={handleContentChange} mode={mode} />
      ) : session.kind === "csv" ? (
        <CsvTableEditor
          value={session.currentContent}
          onChange={handleContentChange}
          mode={mode === "preview" ? "table" : "raw"}
          dict={csvDict}
        />
      ) : (
        <PlainTextEditor value={session.currentContent} onChange={handleContentChange} />
      )}
    </div>
  );
}
