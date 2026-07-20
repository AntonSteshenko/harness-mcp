import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/oauth/session";
import { createDirectory, deleteDirectory } from "@/lib/storage/directories";
import { StorageError } from "@/lib/storage/errors";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
};

function errorResponse(err: unknown, fallbackMessage: string) {
  const storageError =
    err instanceof StorageError ? err : new StorageError("storage_unreachable", fallbackMessage);
  return NextResponse.json(
    { code: storageError.code, message: storageError.message },
    { status: STATUS_BY_CODE[storageError.code] },
  );
}

export async function POST(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const body = (await request.json()) as { path?: string };
  if (!body.path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await createDirectory(body.path);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, "Unexpected error creating directory");
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
    const result = await deleteDirectory(path);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Unexpected error deleting directory");
  }
}
