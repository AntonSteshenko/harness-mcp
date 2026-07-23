/**
 * Reads the "OS" branding name shown in the page title and app header,
 * from OS_NAME. Falls back to the repo name when unset, so the app is
 * still clearly identifiable out of the box.
 */
export function getOsName(): string {
  return process.env.OS_NAME?.trim() || "harness-mcp";
}
