#!/bin/bash

# Default to internal if no parameter provided
ENV_TYPE="${1:-internal}"

# Validate input
if [[ "$ENV_TYPE" != "internal" && "$ENV_TYPE" != "external" ]]; then
    echo "Error: Parameter must be 'internal' or 'external'"
    echo "Usage: $0 [internal|external]"
    exit 1
fi

python ../preprocess_taiga_ids.py ../../../depmap-deploy/non-public-pipeline-files/data-prep-pipeline/release_inputs_${ENV_TYPE}.template release_inputs_${ENV_TYPE}-DO-NOT-EDIT-ME && conseq run data_prep_pipeline/run_${ENV_TYPE}.conseq
