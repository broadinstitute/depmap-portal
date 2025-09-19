#!/bin/bash
# NOTE: Called outside of breadbox/
if [ "$1" = "" ]; then 
  echo "requires tag name"
  exit 1
fi
IMAGE_TAG="$1"

set -ex

# Build Docker image
export DOCKER_BUILDKIT=1
#docker buildx build --platform=linux/amd64 \
docker build \
 breadbox \
 -t "$IMAGE_TAG" \
 --cache-from us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap-breadbox:latest \
 --build-arg BUILDKIT_INLINE_CACHE=1
