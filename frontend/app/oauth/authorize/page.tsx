import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getRecord } from "@/lib/oauth/store";
import type { RegisteredClient } from "@/lib/oauth/types";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const PAGE_STYLE: CSSProperties = {
  maxWidth: 420,
  margin: "4rem auto",
  fontFamily: "system-ui, sans-serif",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ErrorPage({ message, title }: { message: string; title: string }) {
  return (
    <main style={PAGE_STYLE}>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}

/**
 * GET /oauth/authorize (contracts/oauth-endpoints.md) — implemented as a
 * Server Component page rather than a route.ts, since Next.js doesn't allow
 * both at the same path; the decision (approve/deny) still posts to a
 * separate route handler at /oauth/authorize/decision.
 */
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const clientId = first(params.client_id);
  const redirectUri = first(params.redirect_uri);
  const state = first(params.state) ?? "";
  const codeChallenge = first(params.code_challenge);
  const codeChallengeMethod = first(params.code_challenge_method) ?? "S256";
  const dict = getDictionary(await resolveLanguage()).oauth.authorize;

  if (!clientId || !redirectUri || !codeChallenge) {
    return <ErrorPage message={dict.errorMissingParams} title={dict.cantContinue} />;
  }
  if (codeChallengeMethod !== "S256") {
    return <ErrorPage message={dict.errorUnsupportedChallenge} title={dict.cantContinue} />;
  }

  const client = await getRecord<RegisteredClient>(`clients/${clientId}`);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return <ErrorPage message={dict.errorUnknownClient} title={dict.cantContinue} />;
  }

  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    const continueParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    });
    redirect(`/oauth/login?continue=${encodeURIComponent(`/oauth/authorize?${continueParams.toString()}`)}`);
  }

  return (
    <main style={PAGE_STYLE}>
      <h1>{dict.title}</h1>
      <p>{dict.requesting(client.clientName)}</p>
      <form method="POST" action="/oauth/authorize/decision">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <button type="submit" name="decision" value="approve">
          {dict.approve}
        </button>{" "}
        <button type="submit" name="decision" value="deny">
          {dict.deny}
        </button>
      </form>
    </main>
  );
}
