import { redirect } from "next/navigation";
import { getOsName } from "@/lib/config/app";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import { resolveLanguage } from "@/lib/i18n/resolve";
import EditorApp from "./EditorApp";

export default async function EditorPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/editor")}`);
  }

  const language = await resolveLanguage();

  return <EditorApp osName={getOsName()} language={language} />;
}
