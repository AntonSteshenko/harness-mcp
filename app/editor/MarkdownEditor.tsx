"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const extensions = [markdown()];

/** Split-view Markdown editor (FR-003): raw text left, live rendered
 * preview right. The preview re-renders on every keystroke via React state
 * (no debounce needed — trivially under the 500ms budget, SC-002). */
export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", minHeight: "60vh" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CodeMirror value={value} height="60vh" extensions={extensions} onChange={onChange} />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          borderLeft: "1px solid #ddd",
          paddingLeft: 16,
        }}
      >
        <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
      </div>
    </div>
  );
}
