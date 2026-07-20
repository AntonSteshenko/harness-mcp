import { NextRequest, NextResponse } from "next/server";
import { createFile } from "@/lib/storage/files";
import { normalizeFilePath } from "@/lib/storage/paths";
import { StorageError } from "@/lib/storage/errors";

interface UploadEntry {
  relativePath?: string;
  content?: string;
}

interface UploadRequestBody {
  basePath?: string;
  files?: UploadEntry[];
}

interface UploadResult {
  path: string;
  status: "uploaded" | "skipped" | "failed";
  message?: string;
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

/**
 * Batch-creates .md files under `basePath` (FR-001-FR-006, contracts/api-routes.md).
 * Always responds 200 with a per-file outcome so one file's failure doesn't
 * discard the rest of the batch (Edge Cases).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as UploadRequestBody | null;

  if (!body || typeof body.basePath !== "string" || !Array.isArray(body.files)) {
    return NextResponse.json(
      { code: "invalid_request", message: "basePath (string) and files (array) are required" },
      { status: 400 },
    );
  }

  const results: UploadResult[] = [];

  for (const entry of body.files) {
    const relativePath = entry.relativePath;
    const content = entry.content;

    if (typeof relativePath !== "string" || typeof content !== "string") {
      results.push({ path: String(relativePath ?? ""), status: "failed", message: "Missing relativePath or content" });
      continue;
    }

    if (!isMarkdownPath(relativePath)) {
      results.push({ path: relativePath, status: "skipped", message: "Not a Markdown (.md) file" });
      continue;
    }

    const base = body.basePath.replace(/\/+$/, "");
    const fullPath = normalizeFilePath(base ? `${base}/${relativePath}` : relativePath);

    try {
      await createFile(fullPath, content);
      results.push({ path: fullPath, status: "uploaded" });
    } catch (err) {
      const storageError =
        err instanceof StorageError ? err : new StorageError("storage_unreachable", "Unexpected error uploading file");
      results.push({ path: fullPath, status: "failed", message: storageError.message });
    }
  }

  return NextResponse.json({ results });
}
