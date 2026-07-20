"use client";

import { useState } from "react";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";

export default function EditorPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  function handleSelectFile(path: string) {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them and open a different file?")) {
      return;
    }
    setSelectedPath(path);
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: 280, borderRight: "1px solid #ddd", overflow: "auto", padding: 12 }}>
        <FileTree onSelectFile={handleSelectFile} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <FileEditor path={selectedPath} onDirtyChange={setIsDirty} />
      </div>
    </div>
  );
}
