#!/bin/bash
set -e

ENV_NAME="$1"

if [[ ! -e ../../../depmap-deploy ]]; then
    echo "Expected depmap-deploy checked out at ../../../depmap-deploy"
    exit 1
fi

# Validate input
if [[ -z "$ENV_NAME" ]]; then
    echo "Error: Environment name is required"
    echo "Usage: $0 [internal|external|dmc]"
    exit 1
fi

if [[ "$ENV_NAME" != "internal" && "$ENV_NAME" != "external" && "$ENV_NAME" != "dmc" ]]; then
    echo "Error: Parameter must be 'internal', 'external', or 'dmc'"
    echo "Usage: $0 [internal|external|dmc]"
    exit 1
fi

echo "Preprocessing pipeline: Running conseq..."
exec conseq run run_${ENV_NAME}.conseq
