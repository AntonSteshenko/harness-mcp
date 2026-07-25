import type { CSSProperties } from "react";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, SupportedLanguage } from "@/lib/i18n/languages";

const FIELDSET_STYLE: CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 4,
  padding: "0.75rem 1rem",
  marginBottom: "1rem",
};

const OPTION_STYLE: CSSProperties = { display: "block", marginBottom: "0.4rem" };

/**
 * Shows the browser-detected language pre-selected among all six, letting the
 * visitor pick a different one before submitting (spec 015 FR-002 through
 * FR-004, research.md §5). Plain native radio inputs inside the caller's
 * `<form method="POST" action="/init/submit">` — no client-side state is
 * needed, so this stays a server component; the browser's own radio-group
 * behavior is enough to carry the chosen `lang` value in the form POST.
 */
export function LanguageConfirm({ detected }: { detected: SupportedLanguage }) {
  return (
    <fieldset style={FIELDSET_STYLE}>
      <legend>Language</legend>
      {SUPPORTED_LANGUAGES.map((code) => (
        <label key={code} style={OPTION_STYLE}>
          <input type="radio" name="lang" value={code} defaultChecked={code === detected} /> {LANGUAGE_NAMES[code].native}
        </label>
      ))}
    </fieldset>
  );
}
