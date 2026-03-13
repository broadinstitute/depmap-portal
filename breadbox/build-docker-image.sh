#!/bin/bash
# NOTE: Called outside of breadbox/
if [ "$1" = "" ]; then 
  echo "requires tag name"
  exit 1
fi

IMAGE_TAG="$1"

if [ ! -e .git ] ; then
  echo "This command only works when  run from the root of the git checkout. Change directory before running this command"
  exit 1
fi

set -ex

# save the current sha to help track what we built this docker image from
git rev-parse HEAD > breadbox/git-sha

# Build Elara
yarn --cwd frontend install
yarn --cwd frontend "build:elara"

# Build Docker image
docker build \
 breadbox \
 -t "$IMAGE_TAG" \
