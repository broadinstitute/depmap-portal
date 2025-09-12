FROM ubuntu:jammy

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV PATH="/root/.local/bin:/usr/local/bin:${PATH}"

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
    virtualenv \
    wget \
    gpg \
    git \
    software-properties-common \
    locales \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# Install Docker
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce docker-ce-cli containerd.io && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3.9 for conseq
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y \
    python3.9 \
    python3.9-distutils \
    python3.9-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment for conseq
RUN virtualenv --python=python3.9 /install/conseq

# Install taigapy in conseq environment
RUN /install/conseq/bin/pip install --extra-index-url=https://us-central1-python.pkg.dev/cds-artifacts/public-python/simple/ taigapy

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
    poetry --version

WORKDIR /work/analysis-pipeline
COPY pyproject.toml poetry.lock ./
RUN poetry install

# Install gcloud
RUN apt-get update && apt-get install -y curl gnupg && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - && \
    echo "deb https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
    apt-get update && \
    apt-get install -y google-cloud-cli
