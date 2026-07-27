import type { MessagingConfig } from "./config";
import { MessagingError } from "./errors";

interface TelegramApiResponse {
  ok: boolean;
  error_code?: number;
  description?: string;
}

/**
 * Sends one message via the Telegram Bot API's sendMessage endpoint
 * (research.md §2) — a single fetch call, no bot-framework dependency.
 */
export async function sendTelegramMessage(chatId: string, text: string, config: MessagingConfig): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = (await response.json()) as TelegramApiResponse;
  if (!data.ok) {
    if (data.error_code === 400 || data.error_code === 403) {
      throw new MessagingError(
        "unauthorized",
        `Telegram rejected the request for chat "${chatId}": ${data.description ?? "bot cannot reach this chat"}`,
      );
    }
    throw new MessagingError(
      "delivery_failed",
      `Telegram API error: ${data.description ?? `unexpected response (HTTP ${response.status})`}`,
    );
  }
}
