/** PKCE S256 challenge/verifier check (RFC 7636), used by /oauth/token (research.md §1). */
export async function computeS256Challenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("base64url");
}

export async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const computed = await computeS256Challenge(codeVerifier);
  return computed === codeChallenge;
}
