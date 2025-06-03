#################################################################################
#
# Bump the version in pipeline-run-docker/image-name whenever you make a change
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

# create it's own env to keep isolated from system packages installed at end
RUN virtualenv /install/dsub && \
    /install/dsub/bin/pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
    ln -s /install/dsub/bin/dsub /usr/local/bin/dsub && \
    ln -s /install/dsub/bin/dstat /usr/local/bin/dstat

RUN mkdir -p /root/.taiga

# Sparkles v5 requires python==3.10^
RUN virtualenv --python=python3.10 /install/sparkles && \
    /install/sparkles/bin/pip install https://github.com/user-attachments/files/20561197/sparklespray-5.3.1.tar.gz

RUN virtualenv /install/gsutil && /install/gsutil/bin/pip install gsutil

ENV PATH="${PATH}:/install/gsutil/bin"

# taken from https://webkul.com/blog/setup-locale-python3/
RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

RUN virtualenv --python=python3.9 /install/conseq
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

# Set up Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - 
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /work/pipline-run-docker
COPY pyproject.toml poetry.lock ./
# because this is a docker image, we don't really need virtual envs for isolation
# tell poetry to install in system installation of python to keep things simple
RUN poetry config virtualenvs.create false && poetry install


