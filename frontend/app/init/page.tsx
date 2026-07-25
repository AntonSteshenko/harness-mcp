import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkOsStatus } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { verifyStorageConnection } from "@/lib/storage/client";
import { StorageConfigError } from "@/lib/storage/errors";
import { EnvSetupHelper } from "./EnvSetupHelper";
import { McpConnectManual } from "./McpConnectManual";

const PAGE_STYLE: CSSProperties = {
  maxWidth: 640,
  margin: "4rem auto",
  fontFamily: "system-ui, sans-serif",
};

/** Bootstraps a fresh Company OS in the configured storage bucket (spec 014). */
export default async function InitPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  try {
    await verifyStorageConnection();
  } catch (err) {
    if (!(err instanceof StorageConfigError)) throw err;

    return (
      <main style={PAGE_STYLE}>
        <EnvSetupHelper />
      </main>
    );
  }

  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/init")}`);
  }

  const status = await checkOsStatus();
  const params = await searchParams;

  if (status === "partial") {
    return (
      <main style={PAGE_STYLE}>
        <h1>Unexpected storage state</h1>
        <p>
          This storage is in an unexpected, partially-initialized state — only one of{" "}
          <code>os/</code> or <code>data/</code> exists. No setup action is available here;
          resolve this manually before continuing.
        </p>
      </main>
    );
  }

  if (status === "already_initialized") {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const mcpUrl = `${proto}://${host}/mcp`;

    return (
      <main style={PAGE_STYLE}>
        <McpConnectManual mcpUrl={mcpUrl} justCreated={params.created === "1"} />
      </main>
    );
  }

  return (
    <main style={PAGE_STYLE}>
      <h1>Set up your Company OS</h1>
      <p>
        This creates the starting structure — <code>os/</code>, <code>data/</code>,{" "}
        <code>AGENTS.md</code>, and <code>os/skills/init.md</code>. No details are asked here;
        once connected, your AI assistant reads <code>os/skills/init.md</code> and interviews
        you for the rest.
      </p>
      <form method="POST" action="/init/submit">
        <button type="submit">Initialize Company OS</button>
      </form>
    </main>
  );
}
