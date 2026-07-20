#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

echo "Resetting local S3 storage (this will permanently delete all local buckets/objects)..."
docker compose down

# Storage data lives in a bind-mounted host folder (./data/minio), not a Docker
# named volume, so "docker compose down -v" has nothing to remove here. MinIO
# writes those files as root, so clear them via a throwaway container instead
# of a host-side "rm -rf" that could fail on permissions.
docker run --rm --entrypoint sh -v "$(pwd)/data/minio:/data" minio/minio -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; true'

docker compose up -d

echo "Local S3 storage has been reset."
