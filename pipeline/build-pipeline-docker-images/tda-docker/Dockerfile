FROM ubuntu:jammy

RUN apt-get update --fix-missing

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata

RUN apt-get -y install software-properties-common littler pip \
    openssh-client git virtualenv curl nano libcurl4-openssl-dev libxml2-dev \
    build-essential libssl-dev libffi-dev

RUN pip install boto google.cloud.storage

RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get install -y python3.9 python3.9-distutils python3.9-dev
RUN virtualenv --python=python3.9 /install/conseq

# Download public key from github.com
RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

RUN virtualenv --python=python3.9 /install/depmap-py
RUN /install/depmap-py/bin/pip install matplotlib pandas scikit-learn boto
RUN /install/depmap-py/bin/pip install git+https://github.com/broadinstitute/cds-ensemble.git@5c16319ce5edad8e0a99c57ac7090f258afe7adc
ENV PATH="/install/depmap-py/bin:${PATH}"

COPY conseq-settings /root/.conseq
COPY conseq-2.0.2.tar.gz /tmp

RUN cd /tmp && \
    mkdir conseq-install && \
    cd conseq-install && \
    tar -xzf /tmp/conseq-2.0.2.tar.gz && \
    cd conseq-2.0.2 && \
    /install/conseq/bin/pip install . && \
    /install/conseq/bin/pip install markupsafe==2.0.1 && \
    cp /install/conseq/lib/python3.9/site-packages/conseq/helper.py /helper.py && \
    ln -s /install/conseq/bin/conseq /usr/bin/conseq
