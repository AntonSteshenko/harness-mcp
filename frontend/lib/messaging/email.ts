import nodemailer from "nodemailer";
import type { MessagingConfig } from "./config";

/**
 * Sends one email via the configured SMTP account (research.md §1). Any
 * error thrown by nodemailer propagates unchanged to the caller, which
 * wraps it as a `delivery_failed` MessagingError (contracts/mcp-tools-messaging.md).
 */
export async function sendEmailToRecipient(
  to: string,
  subject: string,
  body: string,
  config: MessagingConfig,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
  });

  await transport.sendMail({
    from: config.smtpFrom,
    to,
    subject,
    text: body,
  });
}
