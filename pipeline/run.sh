#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# This script is intended to a very thin shell which is responsible for 
# getting the environment set up enough to be able to run the docker container

# first start by figuring out where this run.sh script is so we can make all paths relative to that
SCRIPT_HOME="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"

# find the path to the top level of the checkout
REPO_ROOT="$(dirname "${SCRIPT_HOME}")"

if [ -e "${SCRIPT_HOME}/.env" ]; then
    source "${SCRIPT_HOME}/.env"
fi

# check for required environment variables
if [ "${DOCKER_CONTAINER_NAME}" == "" ]; then
  echo "Needs value set for DOCKER_CONTAINER_NAME"
  exit 1
fi

if [ "${GOOGLE_APPLICATION_CREDENTIALS}" == "" ]; then
  echo "Needs value set for GOOGLE_APPLICATION_CREDENTIALS"
  exit 1
fi

if [ "$DEPMAP_DEPLOY_BRANCH" == "" ]; then
    echo "the environment variable DEPMAP_DEPLOY_BRANCH must be set to run this script"
    exit 1
fi

# Default various parameters if not set
if [ "${SPARKLES_HOME}" == "" ]; then
  SPARKLES_HOME="$HOME/.sparkles-cache"
fi

if [ "TAIGA_HOME" == "" ]; then
  TAIGA_HOME="$HOME/.taiga"
fi

# run poetry if the lock file has changed
POETRY_LOCK_HASH_FILE="${SCRIPT_HOME}/.poetry-lock-sha256"
POETRY_LOCK_HASH=$(sha256sum ${SCRIPT_HOME}/poetry.lock | awk '{print $1}')
if [ -f "$POETRY_LOCK_HASH_FILE" ] && [ "$(cat "$POETRY_LOCK_HASH_FILE")" = "$POETRY_LOCK_HASH" ]; then
    echo "Poetry lock unchanged -- skipping install"
else
    cd "$SCRIPT_HOME"
    poetry install
    echo "$POETRY_LOCK_HASH" > "$POETRY_LOCK_HASH_FILE"
fi

# ==============================================
# CHECKOUT DEPLOY REPO
# ==============================================
echo "Setting up depmap-deploy repo..."
cd "$REPO_ROOT"
if [ -d depmap-deploy ] ; then
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; cd depmap-deploy ; git pull'
else
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; git clone git@github.com:broadinstitute/depmap-deploy.git'
fi

( cd depmap-deploy && git checkout "$DEPMAP_DEPLOY_BRANCH" )

IMAGE_NAME=$(cat ${SCRIPT_HOME}/image-name)

# Start docker container
cd "$SCRIPT_HOME"
exec docker run --rm -v ${REPO_ROOT}:${REPO_ROOT} \
  --pull=always \
  -w $SCRIPT_HOME \
  -v ${SPARKLES_HOME}:/root/.sparkles-cache \
  -v ${GOOGLE_APPLICATION_CREDENTIALS}:${GOOGLE_APPLICATION_CREDENTIALS} \
  -v ${TAIGA_HOME}:/root/.taiga \
  -e GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS} \
  --name ${DOCKER_CONTAINER_NAME} \
  ${IMAGE_NAME} \
  poetry run "$@"

