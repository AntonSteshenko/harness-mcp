import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const apiPort = process.env.MINIO_API_PORT ?? "9000";

export const s3Client = new S3Client({
  endpoint: `http://localhost:${apiPort}`,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER ?? "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
  },
});

export const BUCKET = process.env.MCP_STORAGE_BUCKET ?? "mcp-storage";

let bucketReady: Promise<void> | undefined;

/**
 * FR-013: the server operates against a single, pre-configured bucket.
 * Ensures that bucket exists so callers never have to provision it by hand.
 */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      } catch {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      }
    })();
  }
  return bucketReady;
}
