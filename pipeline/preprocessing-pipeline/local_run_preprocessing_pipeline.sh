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

# Create temporary symlinks to non-public files in depmap-deploy
# This is to mirror the structure of the workspace in jenkins
# For preprocessing pipeline, the structure is different compared to the data-prep-pipeline because 
# the preprocessing pipeline has a public template and a non-public template which lives in two different repos.
echo "Preprocessing pipeline: Creating temporary symlinks to depmap-deploy..."
ln -sf "../../../depmap-deploy/non-public-pipeline-files/preprocessing-pipeline/xrefs-non-public.template" "xrefs-non-public.template"
ln -sf "../../../depmap-deploy/non-public-pipeline-files/preprocessing-pipeline/xrefs-${ENV_NAME}.template" "xrefs-${ENV_NAME}.template"
ln -sf "../../depmap-deploy/non-public-pipeline-files/${ENV_NAME}.template" "../${ENV_NAME}.template"
ln -sf "../../../depmap-deploy/non-public-pipeline-files/preprocessing-pipeline/run_${ENV_NAME}.conseq" "run_${ENV_NAME}.conseq"
ln -sf "../../../depmap-deploy/non-public-pipeline-files/preprocessing-pipeline/_run_${ENV_NAME}.conseq" "_run_${ENV_NAME}.conseq"

echo "Preprocessing pipeline: Running conseq..."
conseq run run_${ENV_NAME}.conseq
