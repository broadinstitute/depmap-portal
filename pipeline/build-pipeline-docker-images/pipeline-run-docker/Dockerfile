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

FROM ubuntu:jammy

RUN apt-get update --fix-missing
RUN apt-get upgrade -y

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata

RUN apt-get -y install python3 python3-pip curl unzip build-essential libssl-dev libffi-dev python3-dev \
    libcurl4-openssl-dev libxml2-dev virtualenv wget gpg git software-properties-common locales

RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get install -y python3.9 python3.9-distutils python3.9-dev

# taken from https://webkul.com/blog/setup-locale-python3/
RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

RUN mkdir -p /root/.taiga && mkdir -p /root/.local/bin

# install dsub in virtual environment and put symlink into /root/.local/bin
RUN virtualenv /install/dsub && \
    /install/dsub/bin/pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
    ln -s /install/dsub/bin/dsub /root/.local/bin && \
    ln -s /install/dsub/bin/dstat /root/.local/bin 

# install sparkles v5 (requires python==3.10 )
RUN virtualenv --python=python3.10 /install/sparkles && \
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
RUN virtualenv --python=python3.9 /install/conseq && \
     /install/conseq/bin/pip install --extra-index-url https://us-central1-python.pkg.dev/cds-artifacts/public-python/simple/ conseq==2.1.2 && \
    ln -s /install/conseq/bin/conseq /root/.local/bin

# copy the conseq helper into known location
RUN cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py

# # install up Poetry
RUN virtualenv --python=python3.9 /install/poetry && \
    /install/poetry/bin/pip install -U pip setuptools && \
    /install/poetry/bin/pip install poetry && \
    ln -s /install/poetry/bin/poetry /root/.local/bin

# set up the virtual env we want to use as the default python interpreter (by adding to the front of the path)
# this one will have all the dependencies we require installed
WORKDIR /work/pipline-run-docker
COPY pyproject.toml poetry.lock ./
RUN virtualenv --python=python3.9 /install/default-python && . /install/default-python/bin/activate && /install/poetry/bin/poetry install

ENV VIRTUAL_ENV='/install/default-python'
ENV PATH="${VIRTUAL_ENV}/bin:/root/.local/bin:${PATH}"


