FROM python:3.9

# install conseq to get the conseq-helper command which conseq needs to run commands inside
# containers and transfer data in and out of the container.
ADD https://github.com/broadinstitute/conseq/archive/refs/tags/v1.29.0.tar.gz /install/conseq.tar.gz
RUN cd /install && \
    tar xzf /install/conseq.tar.gz && \
    python -m venv /opt/conseq && \
    /opt/conseq/bin/python -m pip install poetry && \
    bash -c 'source /opt/conseq/bin/activate  && cd /install/conseq-1.29.0 && poetry install'
