"use client";

import { useState } from "react";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { Header } from "./Header";

export default function EditorApp({ osName }: { osName: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleSelectFile(path: string) {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them and open a different file?")) {
      return;
    }
    setSelectedPath(path);
    setSidebarOpen(false);
  }

  /** Closes the editor when the file it has open is deleted from the tree (FR-003). */
  function handleFileDeleted(path: string) {
    setSelectedPath((current) => (current === path ? null : current));
  }

  /** Closes the editor when the open file was inside a folder that got deleted. */
  function handleFolderDeleted(folderPath: string) {
    setSelectedPath((current) => (current && current.startsWith(`${folderPath}/`) ? null : current));
  }

  return (
    <div className="app-shell">
      <Header osName={osName} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="body-row">
        <div className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
          <FileTree
            onSelectFile={handleSelectFile}
            onFileDeleted={handleFileDeleted}
            onFolderDeleted={handleFolderDeleted}
          />
        </div>
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <div className="editor-pane">
          <FileEditor path={selectedPath} onDirtyChange={setIsDirty} />
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
