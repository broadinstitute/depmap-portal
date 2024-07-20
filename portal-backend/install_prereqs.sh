#!/usr/bin/env bash
set -ex

if [ "$CONDA_DEFAULT_ENV" != "" ] && [ "$CONDA_DEFAULT_ENV" != "base" ]; then
    echo "conda environment is activated. May cause problems. Please run without a conda environment activated"
    exit 1
fi

if [ ! -e ../../depmap-deploy ]; then
    echo "Some config files have moved to the depmap-deploy repo. Make sure you have depmap-repo checked out into the same repo as the depmap checkout"
    exit 1
fi

for envname in [ dmc peddep public skyros ]; do
    # Create the directory if it doesn't already exist
    mkdir -p ../config/${envname}
    # Copy env configs from the local depmap-deploy repo 
    for filename in [ announcements.yaml dmc_symposia.yaml documentation.yaml downloads theme settings.py ] ; do
        if [ -e ../../depmap-deploy/portal-config/env/${envname}/${filename} ] && [ ! -e ../config/${envname}/${filename} ] ; then
            (cd ../config/${envname} && ln -s ../../../depmap-deploy/portal-config/env/${envname}/${filename} .)
        fi
    done
done

source setup_env.sh

# install python requirements
poetry env use python3.9
poetry install

# generate python version of shared constants between frontend and backend
python ../depmap-shared/generate-py ../depmap-shared/color_palette.json depmap/utilities/_color_palette.py


# install static assets used by depmap
yarn --cwd depmap install --modules-folder static/libs

# install modules needed by React frontend
yarn --cwd ../frontend install

# Bundle and minify static css assets (like global.css)
./flask assets build

# delete any old hooks because we want all hooks managed by pre-commit
rm -rf .git/hooks
pre-commit install

# download from secrets manager the key needed when testing locally
if [ ! -e secrets/dev-downloads-key.json ] ; then
  if ! [ -x "$(command -v gcloud)" ]; then
    echo "You must install the gcloud CLI. See instructions at https://cloud.google.com/sdk/docs/install."
    exit 1
  fi

  mkdir -p secrets
  gcloud secrets versions access latest --secret='dev-downloads-key' --project depmap-consortium > secrets/dev-downloads-key.json
fi

# download from secrets manager the key needed for resouce page prototype
if [ ! -e secrets/iqa-forum-api-key.txt ] ; then
  if ! [ -x "$(command -v gcloud)" ]; then
    echo "You must install the gcloud CLI. See instructions at https://cloud.google.com/sdk/docs/install."
    exit 1
  fi

  mkdir -p secrets
  gcloud secrets versions access latest --secret='iqa-forum-api-key' --project depmap-consortium > secrets/iqa-forum-api-key.txt
fi


