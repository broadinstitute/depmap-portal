#!/bin/bash

if [ "$1" == "" ]; then
  echo "needs name of environment"
  exit 1
fi

ENV_NAME="$1"
CONSEQ_FILE="nonquarterly_$ENV_NAME.conseq"
DOCKER_IMAGE=us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap-pipeline-run:v4
COMMIT_SHA=`git rev-parse HEAD`
if [ "${COMMIT_SHA}" == "" ]; then
  COMMIT_SHA="unknown"
fi

set -ex
GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json docker pull ${DOCKER_IMAGE}

PUBLISH_ROOT=$(dirname $(grep publish_dest "pipeline/$CONSEQ_FILE" | sed 's/.*"\(.*\)".*/\1/' ))
EXPORT_PATH="$PUBLISH_ROOT/export"

# Copy all logs. I'm copying this to a new directory because each time we run we gc the state directory and that 
# causes old logs to be deleted which makes it harder to investigate what happened.
function backup_conseq_logs {
    file_list=`mktemp`
    if [ -e pipeline/state ] ; then
        ( cd pipeline/state && \
            find . -name "std*.txt" > ${file_list} && \
            find . -name "*.sh" >> ${file_list} && \
            find . -name "*.log" >> ${file_list} )
        rsync -a pipeline/state preprocess-logs --files-from=${file_list}
        rm ${file_list}
    fi
}

function run_via_container {
    COMMAND="$1"

    docker run \
      --rm \
      -v "$PWD":/work \
      -w /work/pipeline \
      -v "/etc/depmap-pipeline-runner-creds/broad-paquitas:/aws-keys/broad-paquitas" \
      -v "/etc/depmap-pipeline-runner-creds/sparkles:/root/.sparkles-cache" \
      -v "/etc/depmap-pipeline-runner-creds/depmap-pipeline-runner.json":/etc/google_default_creds.json \
      -v "/data2/depmap-pipeline-taiga:/root/.taiga" \
      -e GOOGLE_APPLICATION_CREDENTIALS=/etc/google_default_creds.json \
      -w /work/pipeline \
      --name "demap-pipeline-run-$ENV_NAME" \
      ${DOCKER_IMAGE} \
      bash -c "source /aws-keys/broad-paquitas && source /install/depmap-py/bin/activate && $COMMAND"
}

# use /data2/depmap-pipeline-taiga as the taiga dir because
# different versions of taigapy seem to conflict in pickle format

# backup logs before running GC
backup_conseq_logs

if [ "$MANUALLY_RUN_CONSEQ" = "true" ]; then
  echo "executing: conseq $CONSEQ_ARGS"
  run_via_container "conseq $CONSEQ_ARGS"
else
  # Clean up unused directories from past runs
  run_via_container "conseq gc"

  # Kick off new run
  run_via_container "conseq run --addlabel commitsha=${COMMIT_SHA} --no-reattach --maxfail 5 --remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles $CONSEQ_FILE $CONSEQ_ARGS"

  # Generate export
  run_via_container "conseq export $CONSEQ_FILE $EXPORT_PATH"

  # copy the latest logs
  backup_conseq_logs
fi

# docker container is writing files as root. Fix up permissions after job completes
sudo chown -R ubuntu .
