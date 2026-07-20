import { redirect } from "next/navigation";
import { hasActiveOwnerSession } from "@/lib/oauth/session";
import EditorApp from "./EditorApp";

export default async function EditorPage() {
  const signedIn = await hasActiveOwnerSession();
  if (!signedIn) {
    redirect(`/oauth/login?continue=${encodeURIComponent("/editor")}`);
  }

  return <EditorApp />;
}
