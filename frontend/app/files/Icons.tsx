/**
 * Inline SVG icons for the file tree. Deliberately not emoji/pictograph
 * characters (📂📁📄) — those require a color-emoji font to be installed on
 * the host, and render as blank tofu boxes when one isn't available. SVG
 * paths render identically regardless of installed fonts.
 */

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      style={{
        flexShrink: 0,
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.1s ease",
      }}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#e8a33d" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M14 2v5h5" strokeLinejoin="round" />
    </svg>
  );
}

/** Shared file-outline silhouette used by every category icon below, so they
 * read as "a file" first and differ only by accent color + one small glyph
 * (spec 028 FR-005, FR-006). */
const FILE_OUTLINE_PATH = "M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z";
const FILE_FOLD_PATH = "M14 2v5h5";

export function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d64545" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <rect x="6" y="15" width="9" height="4" rx="1" fill="#d64545" stroke="none" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a7fd6" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <path d="M8 12h8M8 15h8M8 18h5" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export function SpreadsheetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3f9142" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <path d="M7 12.5h10M7 15.5h10M7 18.5h10M10.3 11v8M14.7 11v8" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c77b2e" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <circle cx="9.5" cy="12.5" r="1.3" fill="#c77b2e" stroke="none" />
      <path d="M6.5 18l3.5-3.5 2.5 2.5 3-4 2.5 5" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DiagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e9c94" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <circle cx="8.5" cy="13" r="1.4" strokeWidth={1.3} />
      <circle cx="15.5" cy="18" r="1.4" strokeWidth={1.3} />
      <path d="M9.7 14.2l4.3 2.7" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}

export function MarkupIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5b6b7a" strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d={FILE_OUTLINE_PATH} strokeLinejoin="round" />
      <path d={FILE_FOLD_PATH} strokeLinejoin="round" />
      <path d="M9.5 12.5l-2.2 2.5 2.2 2.5M14.5 12.5l2.2 2.5-2.2 2.5" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M12 16V4M12 4l-5 5M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M12 4v12M12 16l-5-5M12 16l5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NewFileIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M14 2v5h5" strokeLinejoin="round" />
      <path d="M9 15h6M12 12v6" strokeLinecap="round" />
    </svg>
  );
}

export function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

export function NewFolderIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        strokeLinejoin="round"
      />
      <path d="M9 13h6M12 10v6" strokeLinecap="round" />
    </svg>
  );
}
