#!/bin/bash

IMAGE_REPO="$1"
IMAGE_TAG="$2"

set -ex

docker build -t ${IMAGE_REPO}:${IMAGE_TAG} .
docker push ${IMAGE_REPO}:${IMAGE_TAG}
