import { redirect } from "next/navigation";

/**
 * Redirect-only: the editor moved to /files (spec 018 FR-013). Keeps
 * bookmarks/links saved before that rename working instead of 404ing.
 */
export default async function EditorRedirectPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  redirect(`/files${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`);
}
