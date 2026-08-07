import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/oauth/session";
import { createFile, deleteFile, getFileMetadata, readFile, updateFile } from "@/lib/storage/files";
import { StorageError } from "@/lib/storage/errors";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
  unsupported_type: 415,
  too_large: 413,
};

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico",
  "pdf", "zip", "tar", "gz", "7z", "rar",
  "exe", "dll", "so", "bin",
  "woff", "woff2", "ttf", "otf",
  "mp3", "mp4", "mov", "avi", "webm", "wav",
  "doc", "docx", "xls", "xlsx",
]);

function isConclusivelyBinaryExtension(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase();
  return !!extension && BINARY_EXTENSIONS.has(extension);
}

function looksBinaryContent(content: string): boolean {
  return content.includes("�");
}

function errorResponse(err: unknown, fallbackMessage: string) {
  const storageError =
    err instanceof StorageError ? err : new StorageError("storage_unreachable", fallbackMessage);
  return NextResponse.json(
    { code: storageError.code, message: storageError.message },
    { status: STATUS_BY_CODE[storageError.code] },
  );
}

export async function GET(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  // Extensions that conclusively indicate binary content are rejected before
  // ever fetching/decoding the object — avoids wastefully decoding up to
  // 25 MB of binary data as UTF-8 just to discard it (spec 028 research.md §4).
  if (isConclusivelyBinaryExtension(path)) {
    return NextResponse.json(
      { code: "unsupported", message: `"${path}" doesn't look like a text file and can't be edited here` },
      { status: 422 },
    );
  }

  try {
    const result = await readFile(path);
    const content = result.content.toString("utf-8");
    // Extension didn't conclusively resolve it (no/uncommon extension, or a
    // mislabeled file) — fall back to content sniffing (FR-009).
    if (looksBinaryContent(content)) {
      return NextResponse.json(
        { code: "unsupported", message: `"${path}" doesn't look like a text file and can't be edited here` },
        { status: 422 },
      );
    }
    return NextResponse.json({ ...result, content });
  } catch (err) {
    return errorResponse(err, "Unexpected error reading file");
  }
}

/**
 * Cheap change-detection check for the currently open file (spec 019,
 * contracts/file-sync-contract.md): no body, just the `ETag`/`Last-Modified`
 * of `path` — lets the client poll for a change without re-downloading
 * content on every tick (FR-010).
 */
export async function HEAD(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return new NextResponse(null, { status: authError.status });

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const result = await getFileMetadata(path);
    return new NextResponse(null, {
      status: 200,
      headers: { ETag: result.etag, "Last-Modified": new Date(result.lastModified).toUTCString() },
    });
  } catch (err) {
    const storageError =
      err instanceof StorageError ? err : new StorageError("storage_unreachable", "Unexpected error reading metadata");
    return new NextResponse(null, { status: STATUS_BY_CODE[storageError.code] });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path || body.content === undefined) {
    return NextResponse.json(
      { code: "not_found", message: "path and content are required" },
      { status: 404 },
    );
  }

  try {
    const result = await updateFile(body.path, Buffer.from(body.content, "utf-8"));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Unexpected error updating file");
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await createFile(body.path, Buffer.from(body.content ?? "", "utf-8"));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, "Unexpected error creating file");
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await deleteFile(path);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Unexpected error deleting file");
  }
}
