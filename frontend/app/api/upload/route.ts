import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/oauth/session";
import { createFile } from "@/lib/storage/files";
import { normalizeFilePath } from "@/lib/storage/paths";
import { StorageError, tooLarge, unsupportedType } from "@/lib/storage/errors";
import { isAllowedExtension, MAX_UPLOAD_BYTES, mimeTypeForPath } from "@/lib/storage/fileTypes";

interface UploadResult {
  path: string;
  status: "uploaded" | "skipped" | "failed";
  message?: string;
}

function extensionOf(path: string): string {
  return path.split(".").pop() ?? "";
}

/**
 * Batch-creates files under `basePath` from a multipart/form-data request
 * (spec 028 contracts/upload-contract.md, FR-001-FR-004, FR-012). Always
 * responds 200 with a per-file outcome so one file's failure doesn't discard
 * the rest of the batch (Edge Cases). Each part's raw bytes are passed
 * straight through to storage — never decoded as text — so binary uploads
 * survive intact (FR-003).
 */
export async function POST(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const formData = await request.formData().catch(() => null);
  const basePath = formData?.get("basePath");
  const fileEntries = formData?.getAll("files") ?? [];

  if (!formData || typeof basePath !== "string" || fileEntries.length === 0) {
    return NextResponse.json(
      { code: "invalid_request", message: "basePath (text field) and at least one files entry are required" },
      { status: 400 },
    );
  }

  const results: UploadResult[] = [];
  const base = basePath.replace(/\/+$/, "");

  for (const entry of fileEntries) {
    if (!(entry instanceof File)) {
      results.push({ path: "", status: "failed", message: "Invalid file entry" });
      continue;
    }

    const relativePath = entry.name;
    const fullPath = normalizeFilePath(base ? `${base}/${relativePath}` : relativePath);

    if (!isAllowedExtension(relativePath)) {
      results.push({ path: fullPath, status: "failed", message: unsupportedType(relativePath, extensionOf(relativePath)).message });
      continue;
    }

    if (entry.size > MAX_UPLOAD_BYTES) {
      results.push({ path: fullPath, status: "failed", message: tooLarge(relativePath, MAX_UPLOAD_BYTES).message });
      continue;
    }

    try {
      const buffer = Buffer.from(await entry.arrayBuffer());
      const contentType = entry.type || mimeTypeForPath(relativePath);
      await createFile(fullPath, buffer, contentType);
      results.push({ path: fullPath, status: "uploaded" });
    } catch (err) {
      const storageError =
        err instanceof StorageError ? err : new StorageError("storage_unreachable", "Unexpected error uploading file");
      results.push({ path: fullPath, status: "failed", message: storageError.message });
    }
  }

  return NextResponse.json({ results });
}
