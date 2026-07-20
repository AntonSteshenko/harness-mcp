"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Which single view to show — never both at once. Toggled by the caller. */
  mode: "preview" | "edit";
}

const extensions = [markdown()];

/** Single-view Markdown editor: shows either the live-rendered preview or
 * the raw text editor, never both side by side, so it fits narrow/mobile
 * screens. The caller controls which one via `mode`. */
export function MarkdownEditor({ value, onChange, mode }: MarkdownEditorProps) {
  if (mode === "preview") {
    return (
      <div style={{ minHeight: "60vh" }}>
        <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
      </div>
    );
  }

  return <CodeMirror value={value} height="60vh" extensions={extensions} onChange={onChange} />;
}
