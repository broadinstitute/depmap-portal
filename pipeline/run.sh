#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# This script is intended to a very thin shell which is responsible for 
# getting the environment set up enough to be able to run some command
# within the poetry environment. It guarentees:
#  - we're using the right python with the right dependencies
#  - the depmap-deploy-repo is checked out into the right place
#  - our current working directory is the 'pipeline' directory

# first start by figuring out where this run.sh script is so we can make all paths relative to that
SCRIPT_HOME="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"

if [ -e "${SCRIPT_HOME}/.env" ]; then
    source "${SCRIPT_HOME}/.env"
fi

if [ "$DEPMAP_DEPLOY_BRANCH" == "" ]; then
    echo "the environment variable DEPMAP_DEPLOY_BRANCH must be set to run this script"
    exit 1
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
cd "$SCRIPT_HOME/.."
if [ -d depmap-deploy ] ; then
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; cd depmap-deploy ; git pull'
else
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; git clone git@github.com:broadinstitute/depmap-deploy.git'
fi

( cd depmap-deploy && git checkout "$DEPMAP_DEPLOY_BRANCH" )

# Execute the remainder as shell command.
cd "$SCRIPT_HOME"
exec poetry run "$@"
