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
