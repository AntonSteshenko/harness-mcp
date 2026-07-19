#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

echo "Resetting local S3 storage (this will permanently delete all local buckets/objects)..."
docker compose down -v
docker compose up -d

echo "Local S3 storage has been reset."
