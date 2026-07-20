"use client";

export interface PlainTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** Simple plain-text fallback for non-Markdown files (FR-006) — no rendering,
 * no syntax highlighting, just an editable textarea. */
export function PlainTextEditor({ value, onChange }: PlainTextEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: "60vh",
        fontFamily: "monospace",
        fontSize: 14,
        boxSizing: "border-box",
      }}
    />
  );
}
