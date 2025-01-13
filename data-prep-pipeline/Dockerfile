#################################################################################
#
# Bump the version in pipeline-run-docker/image-name whenever you make a change
#
#################################################################################

FROM ubuntu:jammy

RUN apt-get update
RUN apt-get upgrade -y

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata

RUN apt-get -y install python3 python3-pip curl unzip build-essential libssl-dev libffi-dev python3-dev \
    libcurl4-openssl-dev libxml2-dev virtualenv wget gpg git

RUN virtualenv /install/dsub && \
    /install/dsub/bin/pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
    ln -s /install/dsub/bin/dsub /usr/local/bin/dsub && \
    ln -s /install/dsub/bin/dstat /usr/local/bin/dstat

RUN mkdir -p /root/.taiga

RUN apt-get update && \
  apt-get -y install software-properties-common locales

RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get install -y python3.9 python3.9-distutils python3.9-dev
RUN virtualenv --python=python3.9 /install/conseq

# Sparkles v4 requires python==3.10^
RUN virtualenv --python=python3.10 /install/sparkles && \
    /install/sparkles/bin/pip install https://github.com/broadinstitute/sparklespray/releases/download/v4.0.2/sparklespray-4.0.2.tar.gz

RUN virtualenv /install/gsutil && /install/gsutil/bin/pip install gsutil

COPY gsutil-boto-config /root/.boto

RUN pip install boto google.cloud.storage

ENV PATH="${PATH}:/install/gsutil/bin"

# taken from https://webkul.com/blog/setup-locale-python3/
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

COPY conseq-settings /root/.conseq
COPY conseq-2.0.2.tar.gz /tmp
RUN cd /tmp && \
    mkdir conseq-install && \
    cd conseq-install && \
    tar -xzf /tmp/conseq-2.0.2.tar.gz && \
    cd conseq-2.0.2 && \
    /install/conseq/bin/pip install . && \
    ln -s /install/conseq/bin/conseq /usr/bin/conseq
RUN cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py

# Install poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set environment path for Poetry
ENV PATH="/root/.local/bin:${PATH}"

# Configure Poetry to create virtualenv in project directory
RUN poetry config virtualenvs.in-project true

# Copy your project files to the container
COPY pyproject.toml README.md /install/depmap-py/
COPY data_prep_pipeline /install/depmap-py/data_prep_pipeline/
COPY conseq_scripts /install/depmap-py/conseq_scripts/

# # Install dependencies using Poetry
RUN cd /install/depmap-py && poetry install

# Set the path for the installed environment
ENV PATH="/install/depmap-py/.venv/bin:${PATH}"
