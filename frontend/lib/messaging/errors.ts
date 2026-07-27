export type MessagingErrorCode =
  | "invalid_recipient"
  | "invalid_message"
  | "missing_config"
  | "rate_limited"
  | "unauthorized"
  | "delivery_failed";

export class MessagingError extends Error {
  code: MessagingErrorCode;

  constructor(code: MessagingErrorCode, message: string) {
    super(message);
    this.name = "MessagingError";
    this.code = code;
  }
}
