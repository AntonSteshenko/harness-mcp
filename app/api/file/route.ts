import { NextRequest, NextResponse } from "next/server";
import { createFile, deleteFile, readFile, updateFile } from "@/lib/storage/files";
import { StorageError } from "@/lib/storage/errors";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
};

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico",
  "pdf", "zip", "tar", "gz", "7z", "rar",
  "exe", "dll", "so", "bin",
  "woff", "woff2", "ttf", "otf",
  "mp3", "mp4", "mov", "avi", "webm", "wav",
]);

function looksBinary(path: string, content: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension && BINARY_EXTENSIONS.has(extension)) return true;
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
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await readFile(path);
    if (looksBinary(result.path, result.content)) {
      return NextResponse.json(
        { code: "unsupported", message: `"${path}" doesn't look like a text file and can't be edited here` },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Unexpected error reading file");
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path || body.content === undefined) {
    return NextResponse.json(
      { code: "not_found", message: "path and content are required" },
      { status: 404 },
    );
  }

  try {
    const result = await updateFile(body.path, body.content);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Unexpected error updating file");
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await createFile(body.path, body.content ?? "");
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, "Unexpected error creating file");
  }
}

export async function DELETE(request: NextRequest) {
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
