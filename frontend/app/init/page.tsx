import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { checkOsStatus } from "@/lib/os/init";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { verifyStorageConnection } from "@/lib/storage/client";
import { StorageConfigError } from "@/lib/storage/errors";
import { EnvSetupHelper } from "./EnvSetupHelper";
import { InitForm } from "./InitForm";

const PAGE_STYLE: CSSProperties = {
  maxWidth: 640,
  margin: "4rem auto",
  fontFamily: "system-ui, sans-serif",
};

/** Bootstraps a fresh Company OS in the configured storage bucket (spec 014). */
export default async function InitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
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
    return (
      <main style={PAGE_STYLE}>
        <h1>{params.created ? "Your Company OS is ready" : "A Company OS already exists"}</h1>
        <p>
          {params.created
            ? "Your Company OS has been created."
            : "This storage already has a Company OS set up."}{" "}
          Head to the editor to start working with it.
        </p>
        <p>
          <a href="/editor">Go to /editor</a>
        </p>
      </main>
    );
  }

  return (
    <main style={PAGE_STYLE}>
      <InitForm error={params.error} />
    </main>
  );
}
