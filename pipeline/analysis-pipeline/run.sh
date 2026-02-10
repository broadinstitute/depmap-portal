#!/usr/bin/bash

set -ex

# all files that the pipeline uses must be accessible under the current working directory
# in order for the docker container to access it. So, copy things that are from outside of this tree
# before starting. Maybe this should be moved into run_pipeline.py ?
#mkdir -p extern
#cp ../pipeline/preprocess_taiga_ids.py extern

GOOGLE_APPLICATION_CREDENTIALS=$HOME/.secrets/depmap-pipeline-runner.json exec ./run_analysis_pipeline.py \
  --publish-dest gs://preprocessing-pipeline-outputs/depmap-pipeline/test-pred/metadata --env internal "$@"

