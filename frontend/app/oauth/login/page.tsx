import type { CSSProperties } from "react";
import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";

const PAGE_STYLE: CSSProperties = {
  maxWidth: 360,
  margin: "4rem auto",
  fontFamily: "system-ui, sans-serif",
};

const INPUT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem",
  marginBottom: "0.75rem",
  boxSizing: "border-box",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ continue?: string; error?: string }>;
}) {
  const params = await searchParams;
  const continueUrl = params.continue ?? "/settings/connected-apps";
  const dict = getDictionary(await resolveLanguage()).oauth.login;

  const errorMessages: Record<string, string> = {
    invalid_credentials: dict.errorInvalidCredentials,
    locked_out: dict.errorLockedOut,
  };
  const errorMessage = params.error ? errorMessages[params.error] ?? dict.errorGeneric : null;

  return (
    <main style={PAGE_STYLE}>
      <h1>{dict.title}</h1>
      <p>{dict.description}</p>
      {errorMessage && <p style={{ color: "#b00020" }}>{errorMessage}</p>}
      <form method="POST" action="/oauth/login/submit">
        <input type="hidden" name="continue" value={continueUrl} />
        <label htmlFor="username">{dict.username}</label>
        <input style={INPUT_STYLE} id="username" name="username" type="text" required autoFocus />
        <label htmlFor="password">{dict.password}</label>
        <input style={INPUT_STYLE} id="password" name="password" type="password" required />
        <button type="submit">{dict.submit}</button>
      </form>
    </main>
  );
}
