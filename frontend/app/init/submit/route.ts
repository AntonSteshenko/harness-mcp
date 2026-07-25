import { NextRequest, NextResponse } from "next/server";
import { initializeCompanyOs } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";

/** Creates the initial Company OS skeleton — no form fields involved (FR-006, FR-008, FR-009). */
export async function POST(request: NextRequest) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });
  }

  await initializeCompanyOs();

  const initUrl = new URL("/init", request.url);
  initUrl.searchParams.set("created", "1");
  return NextResponse.redirect(initUrl, { status: 303 });
}
