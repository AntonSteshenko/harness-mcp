/**
 * Wraps `fetch` for the editor's client-side calls to its file APIs. If the
 * owner's session has expired mid-use, those APIs respond 401 (spec 009
 * FR-004); this redirects the browser to sign-in instead of leaving the
 * caller to handle a bare 401 (spec 009 Edge Cases).
 */
export async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    window.location.href = `/oauth/login?continue=${encodeURIComponent(window.location.pathname)}`;
  }

  return response;
}
