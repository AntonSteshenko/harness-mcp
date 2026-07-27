import { randomBytes } from "node:crypto";
import type { MessagingErrorCode } from "./errors";
import { putRecord } from "./store";

/** One outbound send attempt, success or failure (data-model.md Send Attempt Record). */
export interface SendAttemptRecord {
  id: string;
  channel: "email" | "telegram";
  destination: string;
  timestamp: string;
  status: "success" | "failure";
  errorCode: MessagingErrorCode | null;
  errorMessage: string | null;
}

export interface SendAttemptInput {
  channel: "email" | "telegram";
  destination: string;
  status: "success" | "failure";
  errorCode?: MessagingErrorCode;
  errorMessage?: string;
}

/** Persists a Send Attempt Record for every call to either messaging tool (spec.md FR-006, FR-008). */
export async function recordSendAttempt(entry: SendAttemptInput): Promise<void> {
  const id = randomBytes(16).toString("hex");
  const record: SendAttemptRecord = {
    id,
    channel: entry.channel,
    destination: entry.destination,
    timestamp: new Date().toISOString(),
    status: entry.status,
    errorCode: entry.errorCode ?? null,
    errorMessage: entry.errorMessage ?? null,
  };
  await putRecord<SendAttemptRecord>(`send-log/${id}`, record);
}
