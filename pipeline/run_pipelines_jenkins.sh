#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -ex

# ==============================================
# CLEANUP PREVIOUS RUNS
# ==============================================
echo "Cleaning up previous Docker containers..."
set +e  # Don't exit on error for cleanup
docker kill depmap-data-prep-pipeline-run-test-perf 2>/dev/null || true
docker kill depmap-preprocessing-pipeline-run-test-perf 2>/dev/null || true
set -e  # Re-enable exit on error

# ==============================================
# SETUP DEPLOY REPO
# ==============================================
echo "Setting up depmap-deploy repo..."
if [ -d depmap-deploy ] ; then
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; cd depmap-deploy ; git pull'
else
    ssh-agent bash -c 'ssh-add /home/ubuntu/.ssh/depmap-deploy-repo-key; git clone git@github.com:broadinstitute/depmap-deploy.git'
fi

( cd depmap-deploy && git checkout depmap-pipeline-reorg-25q3 )

# ==============================================
# DATA PREP PIPELINE
# ==============================================
echo "==================== DATA PREP PIPELINE ===================="

if [ "$CLEAN_START" = "true" ] && [ -d "pipeline/data-prep-pipeline/state" ]; then
    echo "Cleaning data prep pipeline state..."
    sudo chown -f -R ubuntu pipeline/data-prep-pipeline/state || true
    rm -rf pipeline/data-prep-pipeline/state
fi

# Copy non-public conseq files to the pipeline directory
echo "Syncing non-public pipeline files..."
rsync -av depmap-deploy/non-public-pipeline-files/ pipeline/

# Run the Python data prep pipeline script
echo "Starting data prep pipeline..."
python pipeline/data-prep-pipeline/data_prep_pipeline_runner.py test-perf depmap-data-prep-pipeline-run-test-perf

# Check if data prep pipeline succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: Data prep pipeline failed! Stopping execution."
    exit 1
fi

echo "Data prep pipeline completed successfully."

# ==============================================
# PREPROCESSING PIPELINE
# ==============================================
echo "==================== PREPROCESSING PIPELINE ===================="

export PREPROCESSING_PUBLISH_DEST="gs://preprocessing-pipeline-outputs/depmap-pipeline-25q4/preprocessing-pipeline-test-perf/publish"
export PREPROCESSING_EXPORT_PATH="gs://preprocessing-pipeline-outputs/depmap-pipeline-25q4/preprocessing-pipeline-test-perf/export"

if [ "$CLEAN_START" = "true" ] && [ -d "pipeline/preprocessing-pipeline/state" ]; then
    echo "Cleaning preprocessing pipeline state..."
    sudo chown -f -R ubuntu pipeline/preprocessing-pipeline/state || true
    rm -rf pipeline/preprocessing-pipeline/state
fi

echo "Syncing non-public pipeline files..."
rsync -av depmap-deploy/non-public-pipeline-files/ pipeline/

# Run the Python preprocessing pipeline script  
echo "Starting preprocessing pipeline..."
python pipeline/preprocessing-pipeline/preprocessing_pipeline_runner.py \
    test-perf \
    depmap-preprocessing-pipeline-run-test-perf \
    --publish-dest "$PREPROCESSING_PUBLISH_DEST" \
    --export-path "$PREPROCESSING_EXPORT_PATH"

# Check if preprocessing pipeline succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: Preprocessing pipeline failed! Stopping execution."
    exit 1
fi

echo "Preprocessing pipeline completed successfully!"

# ==============================================
# POST-SUCCESS ACTIONS
# ==============================================
echo "==================== ALL PIPELINES COMPLETED ===================="

# If we reach here, the job was successful so potentially kick off the DB rebuild
if [ "$ON_SUCCESS_REBUILD_DB" = "true" ]; then
    echo "Triggering DB rebuild..."
    curl 'https://hooks-proxy.broadinstitute.org/generic-webhook/jenkins/datascidev?token=test-perf+build+db+3amvd0923SSz'
    echo "DB rebuild triggered!"
fi
