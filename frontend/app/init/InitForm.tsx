import type { CSSProperties } from "react";

const INPUT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem",
  marginBottom: "0.75rem",
  boxSizing: "border-box",
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Both questions are required.",
};

/** The two-question Company OS setup form (FR-004, FR-005). */
export function InitForm({ error }: { error?: string }) {
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Setup failed." : null;

  return (
    <>
      <h1>Set up your Company OS</h1>
      <p>Answer two short questions to create your starting structure.</p>
      {errorMessage && <p style={{ color: "#b00020" }}>{errorMessage}</p>}
      <form method="POST" action="/init/submit">
        <label htmlFor="businessName">What is your business called?</label>
        <input style={INPUT_STYLE} id="businessName" name="businessName" type="text" required autoFocus />
        <label htmlFor="businessDescription">What does your business do?</label>
        <input style={INPUT_STYLE} id="businessDescription" name="businessDescription" type="text" required />
        <button type="submit">Create Company OS</button>
      </form>
    </>
  );
}
