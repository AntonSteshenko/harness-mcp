/**
 * Shared binary-vs-text determination (spec 003/018/028), extracted from
 * app/api/file/route.ts so the web editor's open-guard and the MCP
 * read_file tool's guard (spec 029) can't drift apart into two
 * independently-maintained copies of "what counts as binary."
 */

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico",
  "pdf", "zip", "tar", "gz", "7z", "rar",
  "exe", "dll", "so", "bin",
  "woff", "woff2", "ttf", "otf",
  "mp3", "mp4", "mov", "avi", "webm", "wav",
  "doc", "docx", "xls", "xlsx",
]);

/** Cheap, no-I/O check based purely on the path's extension — lets a caller
 * reject a known-binary file before ever fetching/decoding its content. */
export function isConclusivelyBinaryExtension(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase();
  return !!extension && BINARY_EXTENSIONS.has(extension);
}

/** Fallback for extensions that don't conclusively resolve it (no/uncommon
 * extension, or a mislabeled file): decoded UTF-8 content containing the
 * replacement character is a strong signal the underlying bytes weren't
 * actually text. */
export function looksBinaryContent(content: string): boolean {
  return content.includes("�");
}
