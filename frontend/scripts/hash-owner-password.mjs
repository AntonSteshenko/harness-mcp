#!/usr/bin/env node
// Prints a scrypt hash of the given password, suitable for
// OAUTH_OWNER_PASSWORD_HASH (spec 008-mcp-oauth, research.md §4).
// Usage: node scripts/hash-owner-password.mjs '<password>'

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-owner-password.mjs '<password>'");
  process.exit(1);
}

const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, 64);
console.log(`${salt.toString("hex")}:${derivedKey.toString("hex")}`);
