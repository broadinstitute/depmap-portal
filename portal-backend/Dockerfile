# Using the latest LTS debian version 13 (Trixie) on 12/2025
FROM debian:trixie

# Set environment variables to avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
# Using /opt/pyenv instead of /root/.pyenv so all users can access it
ENV PYENV_ROOT="/opt/pyenv"
ENV PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"

# Install base packages and pyenv build dependencies
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    vim nano joe \
    libpq-dev graphviz \
    build-essential zlib1g-dev \
    make git \
    curl wget ca-certificates \
    libssl-dev libbz2-dev libreadline-dev libsqlite3-dev \
    libncurses-dev xz-utils \
    libffi-dev liblzma-dev \
    uuid-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pyenv to /opt/pyenv
RUN curl https://pyenv.run | bash

# Install Python 3.9 with shared library support (required by some packages)
ENV PYTHON_CONFIGURE_OPTS="--enable-shared"
RUN pyenv install 3.9 && pyenv global 3.9

# Create python3.9 venv at /python3.9 for compatibility with existing PATH expectations
RUN python -m venv /python3.9

# create cds-service user and group
RUN groupadd -g 990 cds-service
RUN useradd -u 990 -g 990 cds-service
# create depmap user and group
RUN useradd -u 997 -g cds-service depmap

# these are made for the db build process
# the webapp mounts stuff at /depmap, so that takes after the permissions of the files outside the mount
# whereas the db wants to write to this directory without mounting anything at it
# similarly, the db build wants to write to the taiga cache as it pulls datasets
RUN mkdir -p /depmap && chown -R depmap:cds-service /depmap
RUN mkdir -p /data1/taiga && chown -R depmap:cds-service /data1/taiga

ENV ORIG_PATH="${PATH}"
ENV PATH="/python3.9/bin:${PATH}"
ENV FLASK_APP=autoapp.py
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

# Install requirements
RUN pip install poetry==1.5.1 && poetry config virtualenvs.in-project true

RUN mkdir -p /install
ADD dist/additional-files.tar.gz /install

COPY --chown=depmap:cds-service . /install/portal-backend
RUN cd /install/portal-backend && poetry install

# Reposition this directory. Might decide on a new location for configs 
# have deployment sorted out, but for now, this is where tests are expecting it.
# also fix up the ownership of everything under /install
RUN cp -r /install/config /install/portal-backend && \ 
    chown -R depmap:cds-service /install
WORKDIR /install/portal-backend

USER depmap

RUN echo "breadbox_required=true" > /install/deploy_variables
ENV PATH="/install/portal-backend/.venv/bin:${ORIG_PATH}"

# The JSON form ensures gunicorn receives OS signals directly. Else we get a warning during docker build. 
CMD ["gunicorn", "-b", "0.0.0.0:5001", "autoapp:app", "--access-logfile", "-"]
