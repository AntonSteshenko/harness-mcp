"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { Header } from "./Header";

/**
 * Takes `language` (a plain string), not the assembled dictionary object —
 * several dictionary entries are functions (interpolated messages), and
 * functions can't cross the Server→Client Component prop boundary. Each
 * client component looks up its own slice via `getDictionary()` instead,
 * which is just a plain synchronous object lookup, safe to run client-side.
 */
export default function EditorApp({ osName, language }: { osName: string; language: SupportedLanguage }) {
  const dict = getDictionary(language).editor;
  const router = useRouter();
  const pathname = usePathname();
  // The open file's path is the URL's own path (spec 018 FR-012), not local
  // state, so it can be deep-linked, refreshed, shared, and stepped through
  // via back/forward.
  const selectedPath = pathname === "/files" ? null : pathname.slice("/files/".length);
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleSelectFile(path: string) {
    if (isDirty && !window.confirm(dict.file.discardConfirm)) {
      return;
    }
    router.push(`/files/${path.split("/").map(encodeURIComponent).join("/")}`);
    setSidebarOpen(false);
  }

  /** Closes the editor when the file it has open is deleted from the tree (FR-003). */
  function handleFileDeleted(path: string) {
    if (selectedPath === path) router.replace("/files");
  }

  /** Clears the URL when the open file/folder was the one deleted, or was inside it. */
  function handleFolderDeleted(folderPath: string) {
    if (selectedPath && (selectedPath === folderPath || selectedPath.startsWith(`${folderPath}/`))) {
      router.replace("/files");
    }
  }

  return (
    <div className="app-shell">
      <Header osName={osName} onToggleSidebar={() => setSidebarOpen((open) => !open)} dict={dict.header} />
      <div className="body-row">
        <div className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
          <FileTree
            onSelectFile={handleSelectFile}
            onSelectFolder={handleSelectFile}
            onFileDeleted={handleFileDeleted}
            onFolderDeleted={handleFolderDeleted}
            expandToPath={selectedPath}
            dict={dict.tree}
          />
        </div>
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <div className="editor-pane">
          <FileEditor path={selectedPath} onDirtyChange={setIsDirty} dict={dict.file} csvDict={dict.csv} />
        </div>
      </div>
      <style jsx>{`
        .app-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: system-ui, sans-serif;
        }
        .body-row {
          display: flex;
          flex: 1;
          min-height: 0;
          position: relative;
        }
        .sidebar {
          width: 280px;
          flex-shrink: 0;
          border-right: 1px solid #ddd;
          overflow: auto;
          padding: 12px;
        }
        .sidebar-backdrop {
          display: none;
        }
        .editor-pane {
          flex: 1;
          min-width: 0;
          overflow: auto;
          padding: 12px;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 52px;
            bottom: 0;
            left: 0;
            width: min(85vw, 320px);
            background: #fff;
            z-index: 25;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            box-shadow: 2px 0 12px rgba(0, 0, 0, 0.2);
          }
          .sidebar-open {
            transform: translateX(0);
          }
          .sidebar-backdrop {
            display: block;
            position: fixed;
            top: 52px;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.35);
            z-index: 20;
          }
        }
      `}</style>
    </div>
  );
}
