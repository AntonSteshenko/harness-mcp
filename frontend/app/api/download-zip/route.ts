import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "@/lib/storage/files";
import { listFilesRecursive } from "@/lib/storage/directories";
import { StorageError } from "@/lib/storage/errors";

const STATUS_BY_CODE: Record<StorageError["code"], number> = {
  not_found: 404,
  type_mismatch: 404,
  already_exists: 409,
  storage_unreachable: 502,
};

function baseName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments[segments.length - 1] || "root";
}

/**
 * Zips every .md file under `path` (any depth) for download (FR-007-FR-009,
 * contracts/api-routes.md). Built fully in memory with jszip — see
 * research.md §1 for why not a streaming archiver at this feature's scale.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";

  try {
    const files = await listFilesRecursive(path);

    if (files.length === 0) {
      return NextResponse.json(
        { code: "empty", message: `"${path || "/"}" has no Markdown (.md) files to download` },
        { status: 404 },
      );
    }

    const zip = new JSZip();
    const prefix = path === "" ? "" : `${path.replace(/\/+$/, "")}/`;

    for (const file of files) {
      const entryName = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
      const { content } = await readFile(file.path);
      zip.file(entryName, content);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${baseName(path)}.zip"`,
      },
    });
  } catch (err) {
    const storageError =
      err instanceof StorageError
        ? err
        : new StorageError("storage_unreachable", "Unexpected error building zip archive");
    return NextResponse.json(
      { code: storageError.code, message: storageError.message },
      { status: STATUS_BY_CODE[storageError.code] },
    );
  }
}
