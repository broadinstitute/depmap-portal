FROM us-central1-docker.pkg.dev/depmap-consortium/depmap-docker-images/depmap-base:v11

# create cds-service user and group
RUN groupadd -g 990 cds-service
RUN useradd -u 990 -g 990 cds-service
# create depmap user and group
RUN useradd -u 997 -g cds-service depmap

# these are made for the db build process
# the webapp mounts stuff at /depmap, so that takes after the permissions of the files outside the mount
# wherease the db wants to write to this directory without mounting anything at it
# similarly, the db build wants to write to the taiga cache as it pulls datasets
RUN mkdir -p /depmap && chown -R depmap:cds-service /depmap
RUN mkdir -p /data1/taiga && chown -R depmap:cds-service /data1/taiga

ENV ORIG_PATH="${PATH}"
ENV PATH="/python3.9/bin:${PATH}"
ENV FLASK_APP autoapp.py
ENV LC_ALL C.UTF-8
ENV LANG C.UTF-8

# Install requirements
RUN pip install poetry==1.5.1 && poetry config virtualenvs.in-project true

RUN mkdir -p /install
ADD dist/additional-files.tar.gz /install
COPY dist/git-sha /install/git-sha
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

CMD gunicorn -b 0.0.0.0:5001 autoapp:app --access-logfile -
