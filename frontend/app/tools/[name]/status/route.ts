import { NextRequest, NextResponse } from "next/server";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { TOOL_CATALOG } from "@/lib/mcp-tools/catalog";
import { setToolDisabled } from "@/lib/mcp-tools/store";

/** Owner-initiated tool status change, applied after confirmation (spec 025 FR-001, FR-006, FR-009, FR-010). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "No active owner session" },
      { status: 401 },
    );
  }

  const { name } = await params;
  const form = await request.formData();
  const to = form.get("to");

  const knownTool = TOOL_CATALOG.some((tool) => tool.name === name);
  if (!knownTool || (to !== "active" && to !== "disabled")) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Unknown tool or invalid status" },
      { status: 400 },
    );
  }

  await setToolDisabled(name, to === "disabled");

  return NextResponse.redirect(
    new URL(`/tools?changed=${encodeURIComponent(name)}&to=${encodeURIComponent(to)}`, request.url),
    { status: 303 },
  );
}
