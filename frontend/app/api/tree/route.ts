import { NextRequest, NextResponse } from "next/server";
import { listDirectory } from "@/lib/storage/directories";
import { StorageError } from "@/lib/storage/errors";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
};

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";

  try {
    const result = await listDirectory(path);
    return NextResponse.json(result);
  } catch (err) {
    const storageError =
      err instanceof StorageError
        ? err
        : new StorageError("storage_unreachable", "Unexpected error listing directory");
    return NextResponse.json(
      { code: storageError.code, message: storageError.message },
      { status: STATUS_BY_CODE[storageError.code] },
    );
  }
}
