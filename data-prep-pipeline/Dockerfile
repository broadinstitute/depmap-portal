FROM ubuntu:jammy

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV PATH="/root/.local/bin:/install/gsutil/bin:${PATH}"

# Install system dependencies in a single layer
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y \
    python3 \
    python3-pip \
    curl \
    unzip \
    build-essential \
    nano \
    libssl-dev \
    libffi-dev \
    python3-dev \
    libcurl4-openssl-dev \
    libxml2-dev \
    virtualenv \
    wget \
    gpg \
    git \
    software-properties-common \
    locales \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# Install Python versions
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y \
    python3.9 \
    python3.9-distutils \
    python3.9-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environments and install tools
RUN virtualenv --python=python3.9 /install/conseq && \
    virtualenv --python=python3.10 /install/sparkles && \
    virtualenv /install/gsutil && \
    virtualenv /install/dsub

RUN /install/dsub/bin/pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
    ln -s /install/dsub/bin/dsub /usr/local/bin/dsub && \
    ln -s /install/dsub/bin/dstat /usr/local/bin/dstat && \
    /install/sparkles/bin/pip install https://github.com/broadinstitute/sparklespray/releases/download/v4.0.2/sparklespray-4.0.2.tar.gz && \
    /install/gsutil/bin/pip install gsutil

RUN pip install boto google.cloud.storage

# Set up configuration files
COPY gsutil-boto-config /root/.boto
COPY conseq-settings /root/.conseq

# Install conseq
COPY conseq-2.0.2.tar.gz /tmp/
RUN mkdir -p /tmp/conseq-install && \
    tar -xzf /tmp/conseq-2.0.2.tar.gz -C /tmp/conseq-install && \
    cd /tmp/conseq-install/conseq-2.0.2 && \
    /install/conseq/bin/pip install . && \
    ln -s /install/conseq/bin/conseq /usr/bin/conseq && \
    cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py && \
    rm -rf /tmp/conseq*

# Create necessary directories
RUN mkdir -p /root/.taiga /work/data-prep-pipeline

# Set up Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /work/data-prep-pipeline
COPY pyproject.toml ./
RUN poetry install 
