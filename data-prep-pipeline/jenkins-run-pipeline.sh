#!/bin/bash

if [ "$1" == "" ]; then
# required: env name
  echo "needs name of environment"
  exit 1
fi

ENV_NAME="$1"
CONSEQ_FILE="data_prep_pipeline/common.conseq"
# CONSEQ_FILE="run_$ENV_NAME.conseq"

if [ "$2" == "" ]; then
# required: job name
  echo "needs name to use for job"
  exit 1   
fi 

JOB_NAME="$2"

echo "Directory listing:"
echo $(ls -la)

echo "Current path:"
echo $(pwd)

# if [ "$3" != "" ]; then
# # required: s3 path override
#     PUBLISH_DEST="$3"
#     echo "let publish_dest = \"$PUBLISH_DEST\"" > "pipeline/overriden-$CONSEQ_FILE"
#     # append the result of the conseq file, except for the previous assignment of publish_dest
#     grep -v 'let publish_dest' "pipeline/$CONSEQ_FILE" >> "pipeline/overriden-$CONSEQ_FILE"
#     CONSEQ_FILE="overriden-$CONSEQ_FILE"
# else
#     echo "No s3 path override specified"
# fi

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
    if [ -e data-prep-pipeline/data_prep_pipeline/state ] ; then
        ( cd data-prep-pipeline/data_prep_pipeline/state && \
            find . -name "std*.txt" > ${file_list} && \
            find . -name "*.sh" >> ${file_list} && \
            find . -name "*.log" >> ${file_list} )
        rsync -a data-prep-pipeline/state preprocess-logs --files-from=${file_list}
        rm ${file_list}
    fi
}

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

    # Had to add --security-opt seccomp=unconfined because after dev.cds.team upgrade, getting error due to sec profile. remove this after docker issue fixed
    docker run \
      --security-opt seccomp=unconfined \
      --rm \
      -v "$PWD":/work \
      -v "${PIPELINE_RUNNER_CREDS_DIR}/broad-paquitas:/aws-keys/broad-paquitas" \
      -v "${PIPELINE_RUNNER_CREDS_DIR}/sparkles:/root/.sparkles-cache" \
      -v "${PIPELINE_RUNNER_CREDS_DIR}/depmap-pipeline-runner.json":/etc/google_default_creds.json \
      -v "${TAIGA_DIR}:/root/.taiga" \
      -e GOOGLE_APPLICATION_CREDENTIALS=/etc/google_default_creds.json \
      -w /work/data-prep-pipeline \
      --name "$JOB_NAME" \
      ${DOCKER_IMAGE} \
      bash -c "source /aws-keys/broad-paquitas && cd /work/data-prep-pipeline && poetry run $COMMAND"
}

# use /data2/depmap-pipeline-taiga as the taiga dir because
# different versions of taigapy seem to conflict in pickle format


# backup logs before running GC
backup_conseq_logs

if [ "$START_WITH" != "" ]; then
    # clean out old invocation
    sudo chown -R ubuntu data-prep-pipeline
    rm -rf data-prep-pipeline/data_prep_pipeline/state
    bash -c "source ${PIPELINE_RUNNER_CREDS_DIR}/broad-paquitas && gsutil cp $START_WITH data-prep-pipeline/data_prep_pipeline/downloaded-export.conseq"
    run_via_container "conseq run downloaded-export.conseq"
    # forget all the executions of "publish" rules because the publish location has changed
    run_via_container "conseq forget --regex publish.*"
fi

if [ "$MANUALLY_RUN_CONSEQ" = "true" ]; then
  echo "executing: conseq $CONSEQ_ARGS"
  run_via_container "conseq $CONSEQ_ARGS"
else
  # Clean up unused directories from past runs
  run_via_container "conseq gc"

  # Kick off new run
  set +e
  run_via_container "conseq run --addlabel commitsha=${COMMIT_SHA} --no-reattach --maxfail 20 --remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles $CONSEQ_FILE $CONSEQ_ARGS"
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
