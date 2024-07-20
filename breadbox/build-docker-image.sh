#!/bin/bash
# NOTE: Called outside of breadbox/
if [ "$1" = "" ]; then 
  echo "requires tag name"
  exit 1
fi
IMAGE_TAG="$1"

set -ex

# Copy breadbox-client package
cp -R breadbox-client breadbox/

# Build Docker image
export DOCKER_BUILDKIT=1
#docker buildx build --platform=linux/amd64 \
docker build \
 breadbox \
 -t "$IMAGE_TAG" \
 --cache-from us.gcr.io/broad-achilles/depmap-breadbox:latest \
 --build-arg BUILDKIT_INLINE_CACHE=1