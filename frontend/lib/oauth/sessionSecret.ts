import { randomBytes } from "node:crypto";
import { getRecord, putRecord } from "./store";

/**
 * One record for the whole app (not one per session) — data-model.md
 * "Generation Record". `generation` is bumped by sign-out (research.md §2)
 * to invalidate every previously issued session cookie at once, without
 * tracking which sessions exist.
 */
interface SessionGenerationRecord {
  secret: string;
  generation: number;
}

const RECORD_KEY = "session-generation";
const CACHE_TTL_MS = 30 * 1000;

let cache: { record: SessionGenerationRecord; fetchedAt: number } | null = null;

async function loadRecord(): Promise<SessionGenerationRecord> {
  const existing = await getRecord<SessionGenerationRecord>(RECORD_KEY);
  if (existing) return existing;

  const created: SessionGenerationRecord = { secret: randomBytes(32).toString("hex"), generation: 0 };
  await putRecord(RECORD_KEY, created);
  return created;
}

/**
 * Returns the current `{ secret, generation }`, cached in this serverless
 * instance's memory for up to `CACHE_TTL_MS` so that validating a session
 * cookie doesn't cost a storage round trip on every request (research.md
 * §3) — only once per warm instance per cache window.
 */
export async function getCurrentGeneration(): Promise<SessionGenerationRecord> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.record;
  }

  const record = await loadRecord();
  cache = { record, fetchedAt: Date.now() };
  return record;
}

/**
 * Invalidates every session cookie issued before this call (sign-out
 * everywhere): bumps `generation` while keeping `secret` unchanged, and
 * refreshes this instance's own cache immediately so the very next request
 * on this instance already reflects it, rather than waiting out the TTL.
 */
export async function bumpGeneration(): Promise<void> {
  const current = await getCurrentGeneration();
  const updated: SessionGenerationRecord = { secret: current.secret, generation: current.generation + 1 };
  await putRecord(RECORD_KEY, updated);
  cache = { record: updated, fetchedAt: Date.now() };
}
