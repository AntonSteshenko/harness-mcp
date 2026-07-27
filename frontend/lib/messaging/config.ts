import { MessagingError } from "./errors";

/**
 * Settings both messaging tools depend on (data-model.md Messaging
 * Configuration) — administrator-provisioned via environment variables, not
 * caller-suppliable per call (spec.md FR-005).
 */
export interface MessagingConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  telegramBotToken: string;
  telegramChatId: string;
  rateLimitMax: number;
  rateLimitWindowMinutes: number;
}

/**
 * Reads messaging configuration from process.env, applying defaults for
 * optional fields. Never throws, even if required values are missing —
 * mirrors lib/storage/config.ts's readStorageConfig() so it's safe to call
 * at module-import time. Use validateEmailConfig()/validateTelegramConfig()
 * to check the result before relying on it for a given channel.
 */
export function readMessagingConfig(): MessagingConfig {
  return {
    smtpHost: process.env.SMTP_HOST?.trim() ?? "",
    smtpPort: Number(process.env.SMTP_PORT?.trim() || "587"),
    smtpSecure: (process.env.SMTP_SECURE?.trim().toLowerCase() ?? "false") === "true",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPassword: process.env.SMTP_PASSWORD ?? "",
    smtpFrom: process.env.SMTP_FROM?.trim() ?? "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? "",
    rateLimitMax: Number(process.env.MESSAGING_RATE_LIMIT_MAX?.trim() || "20"),
    rateLimitWindowMinutes: Number(process.env.MESSAGING_RATE_LIMIT_WINDOW_MINUTES?.trim() || "60"),
  };
}

/** Throws a `missing_config` MessagingError naming every missing SMTP field. */
export function validateEmailConfig(config: MessagingConfig): void {
  const missing: string[] = [];
  if (!config.smtpHost) missing.push("SMTP_HOST");
  if (!config.smtpUser) missing.push("SMTP_USER");
  if (!config.smtpPassword) missing.push("SMTP_PASSWORD");
  if (!config.smtpFrom) missing.push("SMTP_FROM");
  if (missing.length > 0) {
    throw new MessagingError(
      "missing_config",
      `Missing required email configuration: ${missing.join(", ")}`,
    );
  }
}

/**
 * Throws a `missing_config` MessagingError naming the missing Telegram
 * field. `telegramChatId` is checked separately by the tool itself (not
 * here) since it's an optional default — a caller can supply `chatId`
 * per call instead of relying on TELEGRAM_CHAT_ID.
 */
export function validateTelegramConfig(config: MessagingConfig): void {
  if (!config.telegramBotToken) {
    throw new MessagingError(
      "missing_config",
      "Missing required Telegram configuration: TELEGRAM_BOT_TOKEN",
    );
  }
}
