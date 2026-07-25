import { NextRequest, NextResponse } from "next/server";
import { initializeCompanyOs } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";

/** Creates the initial Company OS structure from the two setup-form answers (FR-006 through FR-010). */
export async function POST(request: NextRequest) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });
  }

  const form = await request.formData();
  const businessName = form.get("businessName")?.toString().trim() ?? "";
  const businessDescription = form.get("businessDescription")?.toString().trim() ?? "";

  if (!businessName || !businessDescription) {
    const initUrl = new URL("/init", request.url);
    initUrl.searchParams.set("error", "missing_fields");
    return NextResponse.redirect(initUrl, { status: 303 });
  }

  await initializeCompanyOs(businessName, businessDescription);

  const initUrl = new URL("/init", request.url);
  initUrl.searchParams.set("created", "1");
  return NextResponse.redirect(initUrl, { status: 303 });
}
