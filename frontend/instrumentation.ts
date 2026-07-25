/**
 * Next.js startup hook (`register()` runs once per server instance, before
 * the app serves requests) — logs storage/owner-credential misconfiguration
 * loudly at startup, but (spec 014-os-init-page) no longer exits the
 * process over it: doing so made `/init`'s connection-setup helper
 * unreachable, since the process never lived long enough to serve any
 * request. The app now always boots; `middleware.ts` sends every request to
 * `/init` while storage is unconfigured, and `/init`'s own page performs
 * the authoritative live check (contracts/init-page.md).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verifyStorageConnection } = await import("./lib/storage/client");
    try {
      await verifyStorageConnection();
    } catch (err) {
      console.error(`\nWarning: storage connection is misconfigured — visit /init to connect it.\n${(err as Error).message}\n`);
    }

    // spec 008-mcp-oauth: same relaxed pattern for the dedicated OAuth owner
    // credential (separate from the storage credentials above) — logged,
    // not fatal; sign-in simply fails until it's configured.
    const { verifyOwnerCredentialConfig } = await import("./lib/oauth/config");
    try {
      verifyOwnerCredentialConfig();
    } catch (err) {
      console.error(`\nWarning: OAuth owner credential is misconfigured — sign-in will fail until it's set.\n${(err as Error).message}\n`);
    }
  }
}
