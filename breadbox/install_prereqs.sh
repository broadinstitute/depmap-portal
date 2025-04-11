#!/bin/bash
set -e

if [[ "$CONDA_DEFAULT_ENV" != "" ]] && [[ "$CONDA_DEFAULT_ENV" != "base" ]]; then
    echo "conda environment is activated. May cause problems. Please run without a conda environment activated"
    exit 1
fi

echo "Setting up breadbox-client-generator..."
(cd ../breadbox-client-generator && poetry install )

echo "Setting up breadbox dependencies..."

pyenv install "$(cat .python-version)"
poetry env use "$(pyenv which python)"
poetry install

if [ ! -e .env ]; then
  cp .env.dev .env
fi 
