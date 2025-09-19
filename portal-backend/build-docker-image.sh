#!/bin/bash

RUN_YARN="true"
if [[ "$1" == "--skip-yarn" ]]; then
  RUN_YARN="false"
  shift
fi

if [ "$1" = "" ]; then
    echo "Missing name to tag image with"
    exit 1
fi
IMAGE_TAG="$1"

set -ex

if [[ "$RUN_YARN" == "true" ]]; then
    # Install yarn dependencies
    export NODE_OPTIONS="--max_old_space_size=4096"
    NODE_VERSION=`node --version`
    echo node version $NODE_VERSION
    if [[ "$NODE_VERSION" =~ ^v18 ]]; then
        # don't set node options if we've got a new version of node
        NODE_OPTIONS+=" --openssl-legacy-provider"
    else
        echo "Node version is okay. No openssl workaround needed"
    fi
    ( cd ../frontend && yarn install --prefer-offline )

    # Build webpack
    ( cd ../frontend && yarn build:portal  )

    # Build depmap node modules
    yarn --cwd depmap install --modules-folder static/libs

    # Update build id
    #echo "SHA: ${{ github.sha }} Build: ${{ github.run_number	}}" > depmap/templates/build_info.html
    #echo "SHA=\"${{ github.sha }}\"" > depmap/settings/build.py
    #echo "BUILD=\"${{ github.run_number	}}\"" >> depmap/settings/build.py
fi

# generate python version of shared constants between frontend and backend
python3 ../depmap-shared/generate-py ../depmap-shared/color_palette.json depmap/utilities/color_palette.py

# Build tar of files from accessible parent directory
# (Dockerfiles can only reference subdirectories of
# the context directory)
mkdir -p dist
( cd .. && tar -czf portal-backend/dist/additional-files.tar.gz config)

# Build Docker image
DOCKER_BUILDKIT=1 \
  docker build . \
  -t ${IMAGE_TAG} \
  --cache-from us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1

