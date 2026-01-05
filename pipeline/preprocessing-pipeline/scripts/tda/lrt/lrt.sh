#!/bin/bash
set -ex

pipeline_root="$1"
shift

#sparklespray requirements
sparkles_path="$1"
shift

sparkles_config="$1"
shift

#assuming the sparkles config is in the root of the pipeline dir
# pipeline_root=$(dirname "$sparkles_config")

task_params="$1"
shift

#LRT requirements
data_file="$1"
shift

#gather requirements

out_file="$1"

default_url_prefix=$(awk -F "=" '/default_url_prefix/ {print $2}' "$sparkles_config")

ln -s "$data_file" deps.csv

python3 ${pipeline_root}/scripts/compute_hash.py \
        sparkles-4.0 \
        -u deps.csv \
        -u ${pipeline_root}/scripts/tda/lrt/LRT.R:LRT.R \
        --len 10 \
        -o job-hash.txt

job_name=lrt-`cat job-hash.txt`

# There's a long story about why we're using the docker image us.gcr.io/broad-achilles/tda-pipeline:v2
# This is a very old image with very old versions of the various libraries. We recently built an updated
# docker image (us.gcr.io/broad-achilles/depmap-pipeline-tda-lrt:v3) which updated these libraries
# however, it produces different results from before. Now, in a real sense the results aren't exactly different
# in a meaningful way, because most of the differences occur for LRT values < 100, but the scale of many of them
# is drastically different. As a result the distribution of values _looks_ like it has a wildly different scale
# and might cause people to be concerned when there's nothing really different. What appears to be going on
# is that the newer version of the code that fits the skewed-t distribution, appears to be less stable before.
# It was the case that even with the older code, the MLE optmization would fail occasionally, but it in this
# latest version it appears to often get pick some local minima, resulting in a poor fit. (This is somewhat
# a guess on my part, but what I can say is that it's supposed to be choosing the parameters which maximizes
# the likelyhood, and it's simply not finding the maximium. If you initialize it with different starting
# parameters, it sometimes improves, suggesting that it is able to find the maxium for some initial conditions.
# Anyway, internal discussion concluded that it's known that LRT isn't a stable, and we'd prefer to move
# away from it. Given that, I don't think it's worth any additional investigation and I'm electing to just
# continue using the old docker image until the day we can abandon LRT.
#LRT_DOCKER_IMAGE="us.gcr.io/broad-achilles/depmap-pipeline-tda-lrt:v3"
LRT_DOCKER_IMAGE=us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/tda-pipeline:v2

#Submit job
eval "$sparkles_path" \
    --config "$sparkles_config" \
	sub --nodes 10 \
	-n $job_name \
	-u deps.csv \
	-u ${pipeline_root}/scripts/tda/lrt/LRT.R:LRT.R \
	--params "$task_params" \
	--image $LRT_DOCKER_IMAGE \
	Rscript LRT.R deps.csv '{start}' '{end}' 'lrt-{start}-{end}.csv'

# try watch in case the above skipped the submission
eval "$sparkles_path" --config "$sparkles_config" watch $job_name --loglive

# in the event we had some spurious failure see if we can get past it by reseting the failures and trying once more
eval "$sparkles_path" --config "$sparkles_config" reset $job_name
eval "$sparkles_path" --config "$sparkles_config" watch $job_name --loglive

#fetch results from cloud
mkdir -p data/processed/LRT-tasks
gsutil -m cp ${default_url_prefix}/${job_name}/*/*.csv data/processed/LRT-tasks

#gather LRT results by rbind individual tasks
python3 "${pipeline_root}/scripts/tda/lrt/compile_LRT_tasks.py" \
 data/processed/LRT-tasks $out_file
