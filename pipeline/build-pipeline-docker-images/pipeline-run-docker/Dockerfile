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
    libcurl4-openssl-dev libxml2-dev virtualenv wget gpg git

RUN virtualenv /install/dsub && \
    /install/dsub/bin/pip install pip install git+https://github.com/pgm/dsub.git@patched-0.4.13 && \
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
#RUN /install/dsub/bin/pip install dsub==0.3.8


ENV PATH="${PATH}:/install/gsutil/bin"

# taken from https://webkul.com/blog/setup-locale-python3/
RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

COPY conseq-settings /root/.conseq
COPY conseq-2.0.2.tar.gz /tmp
RUN cd /tmp && \
    mkdir conseq-install && \
    cd conseq-install && \
    tar -xzf /tmp/conseq-2.0.2.tar.gz && \
    cd conseq-2.0.2 && \
    /install/conseq/bin/pip install . && \
    ln -s /install/conseq/bin/conseq /usr/bin/conseq

RUN virtualenv --python=python3.9 /install/depmap-py
RUN /install/depmap-py/bin/pip install matplotlib pandas h5py pyarrow pyyaml
RUN /install/depmap-py/bin/pip install 'taigapy @ git+https://github.com/broadinstitute/taigapy@4c4ec6542150fdea98ae5d67a7da8f8c3310a8d3'
RUN /install/depmap-py/bin/pip install boto
RUN /install/depmap-py/bin/pip install statsmodels
RUN /install/depmap-py/bin/pip install pandera
ENV PATH="/install/depmap-py/bin:${PATH}"

# needed for gene_score_confidence jobs
RUN /install/depmap-py/bin/pip install scipy>=1.3.1 sklearn==0.0

RUN cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py
