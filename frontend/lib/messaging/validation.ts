/**
 * Practical "good enough" address check (research.md §5) — not a full RFC
 * 5322 parser, since deliverability can only be confirmed by attempting
 * delivery anyway.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(address: string): boolean {
  return EMAIL_PATTERN.test(address.trim());
}

export function isValidMessageLength(text: string, maxLength: number): boolean {
  return text.trim().length > 0 && text.length <= maxLength;
}
