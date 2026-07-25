"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const INPUT_STYLE: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5rem",
  marginBottom: "0.75rem",
  boxSizing: "border-box",
};

const PRE_STYLE: CSSProperties = {
  background: "#f5f5f5",
  padding: "1rem",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};

interface Fields {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  ownerUsername: string;
  ownerPassword: string;
  osName: string;
}

function buildDotEnvSnippet(fields: Fields): string {
  const lines = [
    `S3_ENDPOINT=${fields.endpoint}`,
    `S3_REGION=${fields.region}`,
    `S3_ACCESS_KEY_ID=${fields.accessKeyId}`,
    `S3_SECRET_ACCESS_KEY=${fields.secretAccessKey}`,
    `S3_BUCKET=${fields.bucket}`,
    `S3_FORCE_PATH_STYLE=${fields.forcePathStyle}`,
    `OAUTH_OWNER_USERNAME=${fields.ownerUsername}`,
    `OAUTH_OWNER_PASSWORD=${fields.ownerPassword}`,
  ];
  if (fields.osName) lines.push(`OS_NAME=${fields.osName}`);
  return lines.join("\n");
}

function CopyButton({ text, dict }: { text: string; dict: Dictionary["init"]["envSetup"] }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? dict.copied : dict.copy}
    </button>
  );
}

/**
 * Environment setup helper shown when storage isn't connected (FR-002,
 * FR-014, FR-015): storage connection, owner sign-in credential, and the
 * optional system name, in one place — everything needed to bring a fresh
 * install up. Purely client-side: the entered values never leave this
 * component — no fetch/XHR call is made anywhere here (research.md §7). One
 * generated snippet is reused for both a local `.env.local` file and a
 * hosting provider's environment-variables UI, since both accept the exact
 * same `NAME=value` lines — only the destination differs, not the format.
 *
 * Takes `language` (a plain string) rather than the assembled dictionary —
 * the object crossing the Server→Client prop boundary must stay
 * serializable, so this looks up its own slice via `getDictionary()`
 * instead (spec 015, same fix as `EditorApp`).
 */
export function EnvSetupHelper({ language }: { language: SupportedLanguage }) {
  const dict = getDictionary(language).init.envSetup;
  const [fields, setFields] = useState<Fields>({
    endpoint: "",
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    forcePathStyle: true,
    ownerUsername: "",
    ownerPassword: "",
    osName: "",
  });

  const snippet = useMemo(() => buildDotEnvSnippet(fields), [fields]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <h1>{dict.title}</h1>
      <p>{dict.description}</p>

      <h2>{dict.storageHeading}</h2>

      <label htmlFor="endpoint">{dict.endpoint}</label>
      <input
        style={INPUT_STYLE}
        id="endpoint"
        type="text"
        placeholder="http://localhost:9000"
        value={fields.endpoint}
        onChange={(e) => update("endpoint", e.target.value)}
      />

      <label htmlFor="region">{dict.region}</label>
      <input
        style={INPUT_STYLE}
        id="region"
        type="text"
        value={fields.region}
        onChange={(e) => update("region", e.target.value)}
      />

      <label htmlFor="accessKeyId">{dict.accessKeyId}</label>
      <input
        style={INPUT_STYLE}
        id="accessKeyId"
        type="text"
        value={fields.accessKeyId}
        onChange={(e) => update("accessKeyId", e.target.value)}
      />

      <label htmlFor="secretAccessKey">{dict.secretAccessKey}</label>
      <input
        style={INPUT_STYLE}
        id="secretAccessKey"
        type="password"
        value={fields.secretAccessKey}
        onChange={(e) => update("secretAccessKey", e.target.value)}
      />

      <label htmlFor="bucket">{dict.bucket}</label>
      <input
        style={INPUT_STYLE}
        id="bucket"
        type="text"
        value={fields.bucket}
        onChange={(e) => update("bucket", e.target.value)}
      />

      <label>
        <input
          type="checkbox"
          checked={fields.forcePathStyle}
          onChange={(e) => update("forcePathStyle", e.target.checked)}
        />{" "}
        {dict.pathStyleLabel}
      </label>

      <h2>{dict.ownerHeading}</h2>
      <p>{dict.ownerDescription}</p>

      <label htmlFor="ownerUsername">{dict.username}</label>
      <input
        style={INPUT_STYLE}
        id="ownerUsername"
        type="text"
        value={fields.ownerUsername}
        onChange={(e) => update("ownerUsername", e.target.value)}
      />

      <label htmlFor="ownerPassword">{dict.password}</label>
      <input
        style={INPUT_STYLE}
        id="ownerPassword"
        type="password"
        value={fields.ownerPassword}
        onChange={(e) => update("ownerPassword", e.target.value)}
      />

      <h2>{dict.systemNameHeading}</h2>

      <label htmlFor="osName">{dict.systemNameLabel}</label>
      <input
        style={INPUT_STYLE}
        id="osName"
        type="text"
        placeholder="harness-mcp"
        value={fields.osName}
        onChange={(e) => update("osName", e.target.value)}
      />

      <h2>{dict.configHeading}</h2>
      <pre style={PRE_STYLE}>{snippet}</pre>
      <CopyButton text={snippet} dict={dict} />

      <h3>{dict.applyHeading}</h3>
      <p>
        <strong>{dict.applyLocallyLabel}</strong>
        {dict.applyLocallyText}
      </p>
      <p>
        <strong>{dict.applyVercelLabel}</strong>
        {dict.applyVercelText}
      </p>
      <p>{dict.reloadNote}</p>
    </>
  );
}
