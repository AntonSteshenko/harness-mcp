"use client";

import type { CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const bannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "10px 14px",
  marginBottom: 8,
  background: "#fff8e1",
  border: "1px solid #e6c200",
  borderRadius: 6,
  color: "#6b5900",
};

const buttonStyle: CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #c9a600",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
};

/**
 * Non-blocking notice shown when the file open in the editor changed
 * externally while the user has unsaved edits (spec 019 US2, FR-005) — never
 * replaces the editor's content on its own, only offers an explicit choice.
 */
export function ExternalChangeBanner({
  onReload,
  onKeepMine,
  dict,
}: {
  onReload: () => void;
  onKeepMine: () => void;
  dict: Dictionary["editor"]["file"];
}) {
  return (
    <div role="alert" style={bannerStyle}>
      <span>{dict.externalChangeMessage}</span>
      <button type="button" style={buttonStyle} onClick={onReload}>
        {dict.externalChangeReload}
      </button>
      <button type="button" style={buttonStyle} onClick={onKeepMine}>
        {dict.externalChangeKeepMine}
      </button>
    </div>
  );
}
