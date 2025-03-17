#!/bin/bash
if [ "$1" == "" ]; then
# required: env name
  echo "needs name of environment"
  exit 1
fi

ENV_NAME="$1"
CONSEQ_FILE="predictability/run_${ENV_NAME}_analysis.conseq"

if [ "$2" == "" ]; then
# required: job name
  echo "needs name to use for job"
  exit 1   
fi 

JOB_NAME="$2"

if [ "$3" != "" ]; then
# optional: export path
    EXPORT_PATH="$3"
    echo "Using export path: $EXPORT_PATH"
else
    # Default export path if not provided
    EXPORT_PATH="gs://preprocessing-pipeline-outputs/analysis-pipeline/$ENV_NAME/export"
    echo "Using default export path: $EXPORT_PATH"
fi

# set DOCKER_IMAGE from pipeline-run-docker/image-name
SCRIPT_PATH=`dirname $0`
source "$SCRIPT_PATH/image-name"

COMMIT_SHA=`git rev-parse HEAD`
if [ "${COMMIT_SHA}" == "" ]; then
  COMMIT_SHA="unknown"
fi

set -ex
GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json docker pull ${DOCKER_IMAGE}

# Copy all logs. I'm copying this to a new directory because each time we run we gc the state directory and that 
# causes old logs to be deleted which makes it harder to investigate what happened.
function backup_conseq_logs {
    file_list=`mktemp`
    if [ -e analysis-pipeline/state ] ; then
        ( cd analysis-pipeline/state && \
            find . -name "std*.txt" > ${file_list} && \
            find . -name "*.sh" >> ${file_list} && \
            find . -name "*.log" >> ${file_list} )
        rsync -a analysis-pipeline/state predictability-logs --files-from=${file_list}
        rm ${file_list}
    fi
}

# use /data2/depmap-pipeline-taiga as the taiga dir because
# different versions of taigapy seem to conflict in pickle format
if [ "$TAIGA_DIR" == "" ] ; then
    TAIGA_DIR="/data2/depmap-pipeline-taiga"
fi

if [ "$PIPELINE_RUNNER_CREDS_DIR" == "" ] ; then
    PIPELINE_RUNNER_CREDS_DIR='/etc/depmap-pipeline-runner-creds'
fi

if [ ! "${PIPELINE_RUNNER_CREDS_DIR}/broad-paquitas" -o ! "${PIPELINE_RUNNER_CREDS_DIR}/sparkles" -o ! "${PIPELINE_RUNNER_CREDS_DIR}/depmap-pipeline-runner.json" ] ; then
    echo "Could not find required file"
    exit 1
fi

function run_via_container {
    COMMAND="$1"
    docker run \
      --rm \
      -v "$PWD":/work \
      -v "${PIPELINE_RUNNER_CREDS_DIR}/sparkles:/root/.sparkles-cache" \
      -v "${PIPELINE_RUNNER_CREDS_DIR}/depmap-pipeline-runner.json":/etc/google_default_creds.json \
      -v "${TAIGA_DIR}:/root/.taiga" \
      -v /etc/google/auth/application_default_credentials.json:/etc/google/auth/application_default_credentials.json \
      -e GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -w /work/analysis-pipeline \
      --name "$JOB_NAME" \
      ${DOCKER_IMAGE} \
      bash -c "gcloud auth configure-docker us.gcr.io && $COMMAND"
}

# backup logs before running GC
backup_conseq_logs

if [ "$MANUALLY_RUN_CONSEQ" = "true" ]; then
  echo "executing: conseq $CONSEQ_ARGS"
  run_via_container "conseq -D is_dev=False $CONSEQ_ARGS"
else
  # Clean up unused directories from past runs
  run_via_container "conseq gc"

  # Kick off new run
  set +e
  run_via_container "conseq run --addlabel commitsha=${COMMIT_SHA} --no-reattach --maxfail 20 --remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles -D is_dev=False $CONSEQ_FILE $CONSEQ_ARGS"
  RUN_EXIT_STATUS=$?
  set -e
  
  # Generate export
  # run_via_container "conseq export $CONSEQ_FILE $EXPORT_PATH"
  
  # Generate report
  # run_via_container "conseq report html"

  # copy the latest logs
  backup_conseq_logs
fi

echo "Pipeline run complete"

# docker container is writing files as root. Fix up permissions after job completes
sudo chown -R ubuntu .

exit $RUN_EXIT_STATUS
