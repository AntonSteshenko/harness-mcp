import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SWRConfig } from "swr";
import { getOsName } from "@/lib/config/app";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { resolveLanguage } from "@/lib/i18n/resolve";
import EditorApp from "./EditorApp";

/**
 * Lives at the stable `/files` segment (not inside the `[[...path]]` catch-all
 * that page.tsx sits in) so `EditorApp` — and the client-side state inside
 * it, notably FileTree's per-folder expand/collapse state — survives
 * navigation between different `/files/<path>` values. Next.js persists a
 * Layout across navigation only when it sits at a segment whose own value
 * isn't what's changing; co-locating it with `[[...path]]` itself (an
 * earlier attempt) did not fix the reported regression where the tree reset
 * on every file/folder click (spec 018 research.md §7).
 *
 * Being at this stable segment means there's no `params.path` to read here,
 * so the current path comes from the `x-pathname` request header set by
 * middleware.ts instead, for the login-redirect target.
 *
 * Also wraps EditorApp in SWRConfig for the same reason: sitting at this
 * stable position means the SWR cache and poll timers survive navigation
 * between different `/files/<path>` values too, instead of resetting on
 * every click (spec 019 research.md §1, §5).
 */
export default async function FilesLayout() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    const pathname = (await headers()).get("x-pathname") ?? "/files";
    redirect(`/oauth/login?continue=${encodeURIComponent(pathname)}`);
  }

  const language = await resolveLanguage();

  return (
    <SWRConfig value={{ refreshInterval: 15000, revalidateOnFocus: true }}>
      <EditorApp osName={getOsName()} language={language} />
    </SWRConfig>
  );
}
