"use client";

import { useMemo, useState, type CSSProperties } from "react";

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

function CopyButton({ text }: { text: string }) {
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
      {copied ? "Copied!" : "Copy"}
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
 */
export function EnvSetupHelper() {
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
      <h1>Set up your environment</h1>
      <p>
        This app needs a storage connection and an owner sign-in credential to work. Fill in
        the fields below to generate a ready-to-use configuration snippet — nothing you type
        here is ever sent anywhere; it only stays in this browser tab.
      </p>

      <h2>Storage connection</h2>

      <label htmlFor="endpoint">Endpoint</label>
      <input
        style={INPUT_STYLE}
        id="endpoint"
        type="text"
        placeholder="http://localhost:9000"
        value={fields.endpoint}
        onChange={(e) => update("endpoint", e.target.value)}
      />

      <label htmlFor="region">Region</label>
      <input
        style={INPUT_STYLE}
        id="region"
        type="text"
        value={fields.region}
        onChange={(e) => update("region", e.target.value)}
      />

      <label htmlFor="accessKeyId">Access key ID</label>
      <input
        style={INPUT_STYLE}
        id="accessKeyId"
        type="text"
        value={fields.accessKeyId}
        onChange={(e) => update("accessKeyId", e.target.value)}
      />

      <label htmlFor="secretAccessKey">Secret access key</label>
      <input
        style={INPUT_STYLE}
        id="secretAccessKey"
        type="password"
        value={fields.secretAccessKey}
        onChange={(e) => update("secretAccessKey", e.target.value)}
      />

      <label htmlFor="bucket">Bucket</label>
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
        Use path-style addressing (required by most self-hosted S3-compatible servers, including
        MinIO)
      </label>

      <h2>Owner sign-in</h2>
      <p>Used to sign in and approve AI assistants, manage tokens, and use the file editor.</p>

      <label htmlFor="ownerUsername">Username</label>
      <input
        style={INPUT_STYLE}
        id="ownerUsername"
        type="text"
        value={fields.ownerUsername}
        onChange={(e) => update("ownerUsername", e.target.value)}
      />

      <label htmlFor="ownerPassword">Password</label>
      <input
        style={INPUT_STYLE}
        id="ownerPassword"
        type="password"
        value={fields.ownerPassword}
        onChange={(e) => update("ownerPassword", e.target.value)}
      />

      <h2>System name (optional)</h2>

      <label htmlFor="osName">What's your system called?</label>
      <input
        style={INPUT_STYLE}
        id="osName"
        type="text"
        placeholder="harness-mcp"
        value={fields.osName}
        onChange={(e) => update("osName", e.target.value)}
      />

      <h2>Configuration</h2>
      <pre style={PRE_STYLE}>{snippet}</pre>
      <CopyButton text={snippet} />

      <h3>Apply it</h3>
      <p>
        <strong>Locally</strong>: paste it into <code>frontend/.env.local</code>, then restart
        the app (<code>npm run dev</code>).
      </p>
      <p>
        <strong>On Vercel</strong>: open your project, go to Settings → Environment Variables,
        and paste the lines above (Vercel accepts a full <code>.env</code>-formatted paste at
        once — or add each line as its own variable), then redeploy.
      </p>
      <p>Once applied, reload this page.</p>
    </>
  );
}
