#!/bin/sh

set -eu

mc alias set messenger "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}"
mc mb --ignore-existing "messenger/${S3_BUCKET}"
mc anonymous set none "messenger/${S3_BUCKET}"
mc cors set "messenger/${S3_BUCKET}" /config/cors.json

echo "MinIO bucket '${S3_BUCKET}' is ready."
