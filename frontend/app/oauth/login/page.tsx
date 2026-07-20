import type { CSSProperties } from "react";

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

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect username or password.",
  locked_out: "Too many failed attempts — try again in a few minutes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ continue?: string; error?: string }>;
}) {
  const params = await searchParams;
  const continueUrl = params.continue ?? "/settings/connected-apps";
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "Sign-in failed." : null;

  return (
    <main style={PAGE_STYLE}>
      <h1>Sign in</h1>
      <p>Sign in as the owner to approve connections and manage connected apps.</p>
      {errorMessage && <p style={{ color: "#b00020" }}>{errorMessage}</p>}
      <form method="POST" action="/oauth/login/submit">
        <input type="hidden" name="continue" value={continueUrl} />
        <label htmlFor="username">Username</label>
        <input style={INPUT_STYLE} id="username" name="username" type="text" required autoFocus />
        <label htmlFor="password">Password</label>
        <input style={INPUT_STYLE} id="password" name="password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
