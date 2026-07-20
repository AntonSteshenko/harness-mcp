/**
 * Next.js startup hook (`register()` runs once per server instance, before
 * the app serves requests) — used to fail fast on storage misconfiguration
 * rather than on the first request (spec 007-s3-storage-config, FR-004/FR-005).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verifyStorageConnection } = await import("./lib/storage/client");
    try {
      await verifyStorageConnection();
    } catch (err) {
      // Next.js logs a failed instrumentation hook but otherwise leaves the
      // process running (every request then 500s) — exit explicitly so
      // misconfiguration actually stops the server (FR-004, FR-005) instead
      // of leaving it up in a broken state.
      console.error(`\nFatal: storage connection is misconfigured — refusing to start.\n${(err as Error).message}\n`);
      process.exit(1);
    }
  }
}
