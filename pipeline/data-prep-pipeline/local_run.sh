#!/bin/bash
set -e

ENV_TYPE="$1"

if [[ ! -e ../../../depmap-deploy ]]; then
    echo "Expected depmap-deploy checked out at ../../../depmap-deploy"
    exit 1
fi


# Validate input
if [[ -z "$ENV_TYPE" ]]; then
    echo "Error: Parameter is required"
    echo "Usage: $0 [internal|external]"
    exit 1
fi

if [[ "$ENV_TYPE" != "internal" && "$ENV_TYPE" != "external" ]]; then
    echo "Error: Parameter must be 'internal' or 'external'"
    echo "Usage: $0 [internal|external]"
    exit 1
fi

echo "Data prep pipeline: Preprocessing taiga ids..."
python ../preprocess_taiga_ids.py \
    ../../../depmap-deploy/non-public-pipeline-files/data-prep-pipeline/release_inputs_${ENV_TYPE}.template \
    release_inputs_${ENV_TYPE}-DO-NOT-EDIT-ME 
    
echo "Data prep pipeline: Running conseq..."
conseq run data_prep_pipeline/run_${ENV_TYPE}.conseq
