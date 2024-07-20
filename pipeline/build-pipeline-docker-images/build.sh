#!/bin/bash

set -ex

IMAGE_REPO="$1"
IMAGE_TAG="$2"
DOCKERFILE_DIR="$3"

cd ${DOCKERFILE_DIR}

# Install conseq
CONSEQ_VERSION=2.0.2
if [ ! -e conseq-${CONSEQ_VERSION}.tar.gz ] ; then
  curl -L https://github.com/broadinstitute/conseq/releases/download/v${CONSEQ_VERSION}/conseq-${CONSEQ_VERSION}.tar.gz -o conseq-${CONSEQ_VERSION}.tar.gz
fi

docker build -t ${IMAGE_REPO}:${IMAGE_TAG} . && docker push ${IMAGE_REPO}:${IMAGE_TAG}
