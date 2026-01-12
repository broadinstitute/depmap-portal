#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -ex

# ==============================================
# PARSE ARGUMENTS
# ==============================================
# $1 = ENV_NAME (deploy_name) - required
# $2 = JOB_NAME (job_name) - required  
# $3 = PREPROCESSING_PUBLISH_DEST (destOverride) - optional
#
# Environment variables (set by Groovy script):
#   PREPROCESSING_EXPORT_PATH - export path for conseq export
#   DEPMAP_DEPLOY_BRANCH - branch to checkout for depmap-deploy repo (default: master)
#   CLEAN_START - if "true", delete state directories before running
#   START_WITH - if set, copy artifacts from specified export path
#   MANUALLY_RUN_CONSEQ - if "true", pass CONSEQ_ARGS directly to conseq
#   CONSEQ_ARGS - additional args to pass to conseq
#   PUBLISH_DATA_PREP_FILES - if "true", publish data-prep files to Taiga

if [ "$1" == "" ]; then
    echo "needs name of environment"
    exit 1
fi
ENV_NAME="$1"

if [ "$2" == "" ]; then
    echo "needs name to use for job"
    exit 1
fi
JOB_NAME="$2"

# Optional third argument for publish destination override
if [ "$3" != "" ]; then
    PREPROCESSING_PUBLISH_DEST="$3"
fi

# Default branch for depmap-deploy repo
if [ "$DEPMAP_DEPLOY_BRANCH" == "" ]; then
    DEPMAP_DEPLOY_BRANCH="master"
fi

# ==============================================
# CLEANUP PREVIOUS RUNS
# ==============================================
echo "Cleaning up previous Docker containers..."
set +e  # Don't exit on error for cleanup
docker kill "depmap-data-prep-pipeline-run-${JOB_NAME}" 2>/dev/null || true
docker kill "depmap-preprocessing-pipeline-run-${JOB_NAME}" 2>/dev/null || true
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

( cd depmap-deploy && git checkout "$DEPMAP_DEPLOY_BRANCH" )

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

# Build data prep pipeline command with optional flags
DATA_PREP_CMD="python pipeline/data-prep-pipeline/data_prep_pipeline_runner.py ${ENV_NAME} depmap-data-prep-pipeline-run-${JOB_NAME}"

if [ "$PUBLISH_DATA_PREP_FILES" = "true" ]; then
    DATA_PREP_CMD="$DATA_PREP_CMD --publish"
    echo "Publishing of data-prep-pipeline generated files is ENABLED"
else
    echo "Publishing of data-prep-pipeline generated files is DISABLED"
fi

# Run the Python data prep pipeline script
echo "Starting data prep pipeline..."
$DATA_PREP_CMD

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

# export PREPROCESSING_PUBLISH_DEST="gs://preprocessing-pipeline-outputs/depmap-pipeline-25q4/preprocessing-pipeline-iqa/publish"
# export PREPROCESSING_EXPORT_PATH="gs://preprocessing-pipeline-outputs/depmap-pipeline-25q4/preprocessing-pipeline-iqa/export"

if [ "$CLEAN_START" = "true" ] && [ -d "pipeline/preprocessing-pipeline/state" ]; then
    echo "Cleaning preprocessing pipeline state..."
    sudo chown -f -R ubuntu pipeline/preprocessing-pipeline/state || true
    rm -rf pipeline/preprocessing-pipeline/state
fi

echo "Syncing non-public pipeline files..."
rsync -av depmap-deploy/non-public-pipeline-files/ pipeline/

# Build preprocessing pipeline command
PREPROCESSING_CMD="python pipeline/preprocessing-pipeline/preprocessing_pipeline_runner.py \
    ${ENV_NAME} \
    depmap-preprocessing-pipeline-run-${JOB_NAME}"

if [ "$PREPROCESSING_PUBLISH_DEST" != "" ]; then
    PREPROCESSING_CMD="$PREPROCESSING_CMD --publish-dest ${PREPROCESSING_PUBLISH_DEST}"
fi

if [ "$PREPROCESSING_EXPORT_PATH" != "" ]; then
    PREPROCESSING_CMD="$PREPROCESSING_CMD --export-path ${PREPROCESSING_EXPORT_PATH}"
fi

if [ "$MANUALLY_RUN_CONSEQ" = "true" ]; then
    PREPROCESSING_CMD="$PREPROCESSING_CMD --manually-run-conseq ${CONSEQ_ARGS}"
fi

if [ "$START_WITH" != "" ]; then
    PREPROCESSING_CMD="$PREPROCESSING_CMD --start-with ${START_WITH}"
fi

# Run the Python preprocessing pipeline script  
echo "Starting preprocessing pipeline..."
eval $PREPROCESSING_CMD

# Check if preprocessing pipeline succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: Preprocessing pipeline failed! Stopping execution."
    exit 1
fi

echo "Preprocessing pipeline completed successfully!"
echo "==================== ALL PIPELINES COMPLETED ===================="
