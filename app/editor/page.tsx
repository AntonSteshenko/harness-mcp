"use client";

import { useState } from "react";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { MenuIcon } from "./Icons";

export default function EditorPage() {
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
    <div className="editor-shell">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="Toggle file browser"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <MenuIcon />
      </button>
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
      <style jsx>{`
        .editor-shell {
          display: flex;
          height: 100vh;
          font-family: system-ui, sans-serif;
          position: relative;
        }
        .sidebar-toggle {
          display: none;
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
          .sidebar-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 8px;
            left: 8px;
            width: 40px;
            height: 40px;
            z-index: 30;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #fff;
            color: #333;
          }
          .sidebar {
            position: fixed;
            inset: 0 auto 0 0;
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
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            z-index: 20;
          }
          .editor-pane {
            padding-top: 56px;
          }
        }
      `}</style>
    </div>
  );
}
