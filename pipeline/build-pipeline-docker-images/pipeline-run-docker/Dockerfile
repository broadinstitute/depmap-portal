#################################################################################
#
# If you update this Dockerfile and are satisfied with the docker build, then please do the following:
#   1. Once github action has successfully built and pushed the image, tag it with a static version e.g. v6 with the 
#      following command:
#      gcloud artifacts docker tags add \
#      us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap-pipeline-run:[Your ga2-build-number-tag] \
#      us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap-pipeline-run:[Your static version tag]
#   2. Update DEFAULT_DOCKER_IMAGE in pipeline/exec.conseq to match the static version tag
#   3. Update the static version tag in pipeline-run-docker/image-name to match the static version tag
#
#################################################################################

# Using Debian Trixie (version 13)
FROM debian:trixie

# Set environment variables to avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# pyenv configuration - using /opt/pyenv so it's accessible system-wide
ENV PYENV_ROOT="/opt/pyenv"
ENV PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"

# Set locale environment variables (C.UTF-8 is available by default, no generation needed)
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Install base packages and pyenv build dependencies
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y \
    tzdata \
    wget curl \
    unzip \
    build-essential \
    libssl-dev \
    libffi-dev \
    libcurl4-openssl-dev \
    libxml2-dev \
    gpg \
    git \
    nano joe \
    # pyenv build dependencies
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libncurses-dev \
    xz-utils \
    liblzma-dev \
    uuid-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pyenv
RUN curl https://pyenv.run | bash

# Install Python 3.9 and 3.10 with shared library support
ENV PYTHON_CONFIGURE_OPTS="--enable-shared"
RUN pyenv install 3.9 && pyenv install 3.10 && pyenv global 3.9

# Create symlinks for python3.9 and python3.10 so they can be called directly
RUN ln -s $(pyenv prefix 3.9)/bin/python /usr/local/bin/python3.9 && \
    ln -s $(pyenv prefix 3.10)/bin/python /usr/local/bin/python3.10

RUN mkdir -p /root/.taiga && mkdir -p /root/.local/bin

# install dsub in virtual environment and put symlink into /root/.local/bin
RUN python3.9 -m venv /install/dsub && \
    /install/dsub/bin/pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
    ln -s /install/dsub/bin/dsub /root/.local/bin && \
    ln -s /install/dsub/bin/dstat /root/.local/bin 

# install sparkles v5 (requires python==3.10)
RUN python3.10 -m venv /install/sparkles && \
    /install/sparkles/bin/pip install https://github.com/broadinstitute/sparklespray/releases/download/v5.4.1/sparklespray-5.4.1.tar.gz && \
    ln -s /install/sparkles/bin/sparkles /root/.local/bin

# install gcloud SDK
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
    gpg --dearmor > /usr/share/keyrings/cloud.google.gpg && \
    apt-get update && \
    apt-get install -y google-cloud-sdk && \
    ln -s $(which gsutil) /root/.local/bin/gsutil

# install conseq in virtual environment
COPY conseq-settings /root/.conseq
RUN python3.9 -m venv /install/conseq && \
    /install/conseq/bin/pip install --extra-index-url https://us-central1-python.pkg.dev/cds-artifacts/public-python/simple/ conseq==2.1.3 && \
    ln -s /install/conseq/bin/conseq /root/.local/bin

# copy the conseq helper into known location
RUN cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py

# install Poetry
RUN python3.9 -m venv /install/poetry && \
    /install/poetry/bin/pip install -U pip setuptools && \
    /install/poetry/bin/pip install poetry && \
    ln -s /install/poetry/bin/poetry /root/.local/bin

# set up the virtual env we want to use as the default python interpreter (by adding to the front of the path)
# this one will have all the dependencies we require installed
WORKDIR /work/pipline-run-docker
COPY pyproject.toml poetry.lock ./
RUN python3.9 -m venv /install/default-python && . /install/default-python/bin/activate && /install/poetry/bin/poetry install

ENV VIRTUAL_ENV='/install/default-python'
ENV PATH="${VIRTUAL_ENV}/bin:/root/.local/bin:${PATH}"
