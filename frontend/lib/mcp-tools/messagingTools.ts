import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readMessagingConfig, validateEmailConfig, validateTelegramConfig } from "@/lib/messaging/config";
import { sendEmailToRecipient } from "@/lib/messaging/email";
import { MessagingError, type MessagingErrorCode } from "@/lib/messaging/errors";
import { checkAndRecordSend } from "@/lib/messaging/rateLimit";
import { recordSendAttempt } from "@/lib/messaging/auditLog";
import { sendTelegramMessage } from "@/lib/messaging/telegram";
import { isValidEmailAddress, isValidMessageLength } from "@/lib/messaging/validation";
import { z } from "zod";
import { ok } from "./result";
import { registerGatedTool } from "./toolGate";

/**
 * Wraps a MessagingError as an MCP `isError` result with the same
 * `{ code, message }` shape as lib/mcp-tools/result.ts's errorResult(), so
 * callers use one parsing convention across every tool in this server
 * (research.md §6). Non-MessagingError failures are reported as
 * `delivery_failed` rather than leaking an unstructured message.
 */
function messagingErrorResult(err: unknown): CallToolResult {
  const messagingError = err instanceof MessagingError
    ? err
    : new MessagingError("delivery_failed", (err as Error)?.message ?? String(err));
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ code: messagingError.code, message: messagingError.message }) }],
  };
}

interface EmailRecipientResult {
  to: string;
  status: "success" | "failure";
  errorCode?: MessagingErrorCode;
  errorMessage?: string;
}

/** Registers the send_email and send_telegram_message MCP tools (spec 017). */
export async function registerMessagingTools(server: McpServer): Promise<void> {
  registerGatedTool(
    server,
    "send_email",
    {
      title: "Send Email",
      description:
        "Sends an email via the pre-configured SMTP account to 1-50 recipients. Reports a " +
        "per-recipient outcome, so a mix of valid and invalid addresses doesn't fail the whole " +
        "call. Uses the server's configured sender identity — no per-call credentials.",
      inputSchema: {
        to: z.array(z.string()).min(1).max(50).describe("1-50 recipient email addresses"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body (plain text)"),
      },
    },
    async ({ to, subject, body }) => {
      try {
        if (!subject.trim() || !body.trim()) {
          throw new MessagingError("invalid_message", "subject and body must not be empty");
        }

        const config = readMessagingConfig();
        validateEmailConfig(config);
        await checkAndRecordSend(config);

        const results: EmailRecipientResult[] = [];
        for (const address of to) {
          if (!isValidEmailAddress(address)) {
            const errorCode: MessagingErrorCode = "invalid_recipient";
            const errorMessage = `"${address}" is not a valid email address`;
            await recordSendAttempt({ channel: "email", destination: address, status: "failure", errorCode, errorMessage });
            results.push({ to: address, status: "failure", errorCode, errorMessage });
            continue;
          }

          try {
            await sendEmailToRecipient(address, subject, body, config);
            await recordSendAttempt({ channel: "email", destination: address, status: "success" });
            results.push({ to: address, status: "success" });
          } catch (err) {
            const errorCode: MessagingErrorCode = "delivery_failed";
            const errorMessage = (err as Error)?.message ?? String(err);
            await recordSendAttempt({ channel: "email", destination: address, status: "failure", errorCode, errorMessage });
            results.push({ to: address, status: "failure", errorCode, errorMessage });
          }
        }

        return ok({ results });
      } catch (err) {
        return messagingErrorResult(err);
      }
    },
  );

  registerGatedTool(
    server,
    "send_telegram_message",
    {
      title: "Send Telegram Message",
      description:
        "Sends a text message via the pre-configured Telegram bot to a target chat/channel. If " +
        "chatId is omitted, sends to the server's configured default chat (TELEGRAM_CHAT_ID). " +
        "The bot must already be a member of the target chat. Uses the server's configured bot " +
        "token — no per-call credentials.",
      inputSchema: {
        chatId: z
          .string()
          .min(1)
          .optional()
          .describe('Telegram chat/channel identifier, e.g. "123456789" or "@channelname". Omit to use the server\'s default configured chat.'),
        text: z.string().min(1).max(4096).describe("Message text (max 4096 characters)"),
      },
    },
    async ({ chatId, text }) => {
      try {
        if (!isValidMessageLength(text, 4096)) {
          throw new MessagingError("invalid_message", "text must be non-empty and at most 4096 characters");
        }

        const config = readMessagingConfig();
        validateTelegramConfig(config);

        const targetChatId = chatId ?? config.telegramChatId;
        if (!targetChatId) {
          throw new MessagingError(
            "missing_config",
            "No chatId was provided and no default is configured (TELEGRAM_CHAT_ID)",
          );
        }

        await checkAndRecordSend(config);

        try {
          await sendTelegramMessage(targetChatId, text, config);
          await recordSendAttempt({ channel: "telegram", destination: targetChatId, status: "success" });
          return ok({ chatId: targetChatId, status: "success" });
        } catch (err) {
          const errorCode: MessagingErrorCode = err instanceof MessagingError ? err.code : "delivery_failed";
          const errorMessage = (err as Error)?.message ?? String(err);
          await recordSendAttempt({ channel: "telegram", destination: targetChatId, status: "failure", errorCode, errorMessage });
          throw err;
        }
      } catch (err) {
        return messagingErrorResult(err);
      }
    },
  );
}
