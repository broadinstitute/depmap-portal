#!/bin/bash

set -ex

# Usage in github action workflow file:
#   bash build.sh IMAGE_REPO IMAGE_TAG DOCKERFILE_DIR
# Usage to manually build the main pipeline-run image only:
#   bash build.sh from-image-name
# which will read the full image (including tag) from
#   pipeline-run-docker/image-name
# and build/push that image using the pipeline-run-docker Dockerfile.

if [ "$1" = "from-image-name" ]; then
  . pipeline-run-docker/image-name
  IMAGE_REPO="${DOCKER_IMAGE%:*}"
  IMAGE_TAG="${DOCKER_IMAGE##*:}"
  DOCKERFILE_DIR="pipeline-run-docker"
else
  IMAGE_REPO="$1"
  IMAGE_TAG="$2"
  DOCKERFILE_DIR="$3"
fi

cd ${DOCKERFILE_DIR}

# Install conseq
CONSEQ_VERSION=2.0.2
if [ ! -e conseq-${CONSEQ_VERSION}.tar.gz ] ; then
  curl -L https://github.com/broadinstitute/conseq/releases/download/v${CONSEQ_VERSION}/conseq-${CONSEQ_VERSION}.tar.gz -o conseq-${CONSEQ_VERSION}.tar.gz
fi

docker build -t ${IMAGE_REPO}:${IMAGE_TAG} . && docker push ${IMAGE_REPO}:${IMAGE_TAG}
