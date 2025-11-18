# Using Debian Trixie with Python 3.9 via pyenv
FROM debian:trixie

# Set environment to non-interactive
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies for pyenv and Python builds
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libffi-dev \
    liblzma-dev \
    libatomic1 \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Install pyenv
ENV PYENV_ROOT=/root/.pyenv
ENV PATH=$PYENV_ROOT/shims:$PYENV_ROOT/bin:$PATH
RUN curl https://pyenv.run | bash

# Install Python 3.9.15 via pyenv
ENV PYTHON_VERSION=3.9.15
RUN pyenv install ${PYTHON_VERSION} && \
    pyenv global ${PYTHON_VERSION} && \
    pyenv rehash

# Create the installation directory
RUN mkdir -p /install/breadbox

# Copy files:
COPY . /install/breadbox
WORKDIR /install/breadbox

# Install dependencies:
RUN pip install poetry==1.8.2 
# Ensure that when packages are installed with Poetry a virtual environment is NOT created first. 
# You’re already in a virtual environment by using a docker image
RUN poetry config virtualenvs.create false
RUN poetry install 
