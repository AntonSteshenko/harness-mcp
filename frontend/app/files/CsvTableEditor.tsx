"use client";

import type { CSSProperties } from "react";
import { parseCsv } from "@/lib/csv";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { PlainTextEditor } from "./PlainTextEditor";

export interface CsvTableEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Which single view to show — never both at once. Toggled by the caller. */
  mode: "table" | "raw";
  dict: Dictionary["editor"]["csv"];
}

const thStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  textAlign: "left",
  padding: "6px 12px",
  background: "#eee",
  fontWeight: 600,
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid #f0f0f0",
  whiteSpace: "nowrap",
};

/** Single-view CSV editor: shows either the read-only table view or the raw
 * text editor, never both side by side (FR-006, FR-007). The caller controls
 * which one via `mode`, mirroring MarkdownEditor's preview/edit toggle. */
export function CsvTableEditor({ value, onChange, mode, dict }: CsvTableEditorProps) {
  if (mode === "raw") {
    return <PlainTextEditor value={value} onChange={onChange} />;
  }

  const { headers, rows, truncated, totalRowCount } = parseCsv(value);

  if (headers.length === 0 && rows.length === 0) {
    return <p style={{ color: "#888" }}>{dict.empty}</p>;
  }

  return (
    <div>
      {truncated && (
        <p style={{ color: "#b8860b" }}>{dict.truncated(rows.length, totalRowCount)}</p>
      )}
      <div style={{ maxHeight: "60vh", overflow: "auto", border: "1px solid #ddd" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th key={i} style={thStyle}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const columnCount = Math.max(headers.length, row.length);
              return (
                <tr key={rowIndex}>
                  {Array.from({ length: columnCount }, (_, colIndex) => (
                    <td key={colIndex} style={tdStyle}>
                      {row[colIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p style={{ color: "#888", padding: "6px 12px" }}>{dict.noRows}</p>}
      </div>
    </div>
  );
}
