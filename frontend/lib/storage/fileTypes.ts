/**
 * Shared allow-list + extension→category table for uploaded files (spec 028).
 * Both the upload route (validation) and the file tree (icon selection)
 * derive from this one table so they can never drift apart.
 */

export type FileCategory = "document" | "spreadsheet" | "image" | "diagram" | "markup" | "archive";

const CATEGORY_EXTENSIONS: Record<FileCategory, string[]> = {
  document: ["pdf", "doc", "docx"],
  spreadsheet: ["xls", "xlsx", "csv"],
  image: ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
  diagram: ["bpmn"],
  markup: ["html", "xml", "css", "md", "txt", "json"],
  archive: ["zip"],
};

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  bpmn: "application/xml",
  html: "text/html",
  xml: "application/xml",
  css: "text/css",
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
  zip: "application/zip",
};

/** Only these open inline (new browser tab) via /api/file/download; every
 * other allowed type downloads as an attachment (research.md §5). */
const NATIVELY_RENDERABLE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Every allowed extension, flattened across categories — used for the
 * upload `<input accept>` attribute and the client-side pre-filter. */
export const ALL_ALLOWED_EXTENSIONS: string[] = Object.values(CATEGORY_EXTENSIONS).flat();

function extensionOf(path: string): string {
  return (path.split(".").pop() ?? "").toLowerCase();
}

export function categoryForPath(path: string): FileCategory | null {
  const extension = extensionOf(path);
  for (const category of Object.keys(CATEGORY_EXTENSIONS) as FileCategory[]) {
    if (CATEGORY_EXTENSIONS[category].includes(extension)) return category;
  }
  return null;
}

export function isAllowedExtension(path: string): boolean {
  return categoryForPath(path) !== null;
}

export function mimeTypeForPath(path: string): string {
  return MIME_TYPES[extensionOf(path)] ?? "application/octet-stream";
}

export function isNativelyRenderable(path: string): boolean {
  return NATIVELY_RENDERABLE_EXTENSIONS.has(extensionOf(path));
}
