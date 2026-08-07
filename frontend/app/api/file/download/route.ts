import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/oauth/session";
import { readFile } from "@/lib/storage/files";
import { StorageError } from "@/lib/storage/errors";
import { isNativelyRenderable } from "@/lib/storage/fileTypes";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
  unsupported_type: 415,
  too_large: 413,
};

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments[segments.length - 1] || path;
}

/**
 * Returns an individual file's raw bytes for retrieval when it can't be (or
 * a user doesn't want it) opened for editing inline (spec 028 contracts/
 * file-retrieval-contract.md, FR-010). Only the clarified native-render set
 * (PDF, JPG/JPEG, PNG) is served with its real Content-Type and an inline
 * disposition, so the browser renders it directly in a new tab; every other
 * type is forced to download as an inert octet-stream — deliberately, to
 * close a stored-XSS vector for uploaded HTML/XML-family content
 * (research.md §5).
 */
export async function GET(request: NextRequest) {
  const authError = await requireOwnerSession();
  if (authError) return authError;

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ code: "not_found", message: "path is required" }, { status: 404 });
  }

  try {
    const result = await readFile(path);
    const filename = baseName(path);

    if (isNativelyRenderable(path)) {
      return new NextResponse(new Uint8Array(result.content), {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    return new NextResponse(new Uint8Array(result.content), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const storageError =
      err instanceof StorageError ? err : new StorageError("storage_unreachable", "Unexpected error reading file");
    return NextResponse.json(
      { code: storageError.code, message: storageError.message },
      { status: STATUS_BY_CODE[storageError.code] },
    );
  }
}
