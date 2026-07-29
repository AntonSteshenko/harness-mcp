import { NextRequest, NextResponse } from "next/server";

const REQUIRED_STORAGE_ENV_VARS = ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"];

function storageObviouslyUnconfigured(): boolean {
  return REQUIRED_STORAGE_ENV_VARS.some((name) => !process.env[name]?.trim());
}

/**
 * `x-pathname`: forwards the current request's path to Server Components
 * that can't get it from route `params` — specifically `app/files/layout.tsx`
 * (spec 018 research.md §7), which must sit at the stable `/files` segment
 * (not inside the `[[...path]]` catch-all itself) for its rendered
 * `EditorApp` to survive client-side navigation between different open
 * files/folders, and so has no dynamic-segment params of its own to read.
 * Set on the *request* (not the response) — Next's documented pattern for
 * making the current pathname readable via `headers()` server-side.
 */
function withPathnameHeader(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Sends every request to /init while storage is obviously unconfigured (spec
 * 014-os-init-page) — now that instrumentation.ts no longer exits the
 * process over it, the app boots regardless, so something has to point a
 * visitor at the connection-setup helper instead of letting every other
 * route fail on its own first storage call.
 *
 * Deliberately a cheap env-var presence check, not a live connectivity
 * probe (that would cost a network round trip on every request) — this
 * only catches "nothing set at all." A reachable-but-wrong config
 * (unreachable endpoint, rejected credentials, missing bucket) isn't
 * redirected here; visiting /init directly still shows the full,
 * authoritative diagnosis via verifyStorageConnection() (contracts/init-page.md).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/init" || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return withPathnameHeader(request);
  }

  if (storageObviouslyUnconfigured()) {
    return NextResponse.redirect(new URL("/init", request.url));
  }

  return withPathnameHeader(request);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
