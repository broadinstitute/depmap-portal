#!/bin/bash
set -e

if [[ -z "$2" || -z "$1" ]]; then
    echo "Error: Environment name and pipeline name is required"
    echo "Usage: $0 [preprocessing-pipeline | analysis-pipeline | data-prep-pipeline] [internal|external|dmc]"
    exit 1
fi

PIPELINE_NAME="$1"
shift

ENV_NAME="$1"
shift

if [[ ! -e ../../depmap-deploy ]]; then
    echo "Expected depmap-deploy checked out at ../../depmap-deploy"
    exit 1
fi

# Validate input

if [[ "$ENV_NAME" != "internal" && "$ENV_NAME" != "external" && "$ENV_NAME" != "dmc" ]]; then
    echo "Error: Parameter must be 'internal', 'external', or 'dmc'"
    echo "Usage: $0 [internal|external|dmc]"
    exit 1
fi

cd "$PIPELINE_NAME"

echo "Preprocessing pipeline: Running conseq..."
exec conseq run run_${ENV_NAME}.conseq "$@"
