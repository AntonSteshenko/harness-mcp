import { resolveLanguage } from "@/lib/i18n/resolve";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries/types";

// The single place to update when a top-level page is added or removed
// (spec 026 FR-007) — this is the only list that needs to change; no
// route-scanning exists to derive it automatically (research.md §4).
const DASHBOARD_LINKS: { href: string; labelKey: keyof Dictionary["dashboard"]["links"] }[] = [
  { href: "/files", labelKey: "files" },
  { href: "/tools", labelKey: "tools" },
  { href: "/settings/connected-apps", labelKey: "settingsConnectedApps" },
  { href: "/settings/personal-access-tokens", labelKey: "settingsPersonalAccessTokens" },
];

/** Lands every visitor on a list of links to every existing top-level page (spec 026). */
export default async function DashboardPage() {
  const dict = getDictionary(await resolveLanguage()).dashboard;

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>{dict.title}</h1>
      <p>{dict.description}</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {DASHBOARD_LINKS.map(({ href, labelKey }) => (
          <li key={href} style={{ padding: "0.5rem 0", borderBottom: "1px solid #ddd" }}>
            <a href={href}>{dict.links[labelKey]}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
