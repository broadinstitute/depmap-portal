FROM us.gcr.io/broad-achilles/depmap-breadbox-base:v2

# install security updated
RUN apt update && apt upgrade -y

# poetry
# https://python-poetry.org/docs/configuration/#using-environment-variables
ENV POETRY_VERSION=1.8.2 
ENV POETRY_HOME="/poetry"
# prepend poetry to path
ENV PATH="$POETRY_HOME/bin:$PATH"
# Install poetry:
RUN curl -sSL https://install.python-poetry.org | python3 - --version $POETRY_VERSION

RUN mkdir /install/breadbox
# Copy in the config files:
COPY pyproject.toml poetry.lock /install/breadbox

# put in place the minimal pythons file so that we can run poetry install at this point
# then if any *.py file, docker can reuse the old layers. (Just make sure that
# COPY *.py and COPY breadbox ... are all after `poetry install`. Poetry install doesn't
# need them, and poetry install does take some time.
COPY breadbox-client /install/breadbox-client
RUN mkdir -p /install/breadbox/breadbox && echo '# stubbing out this file just so we can run poetry install (just an optimization for rebuilding docker image faster after code changes)' > /install/breadbox/breadbox/__init__.py

WORKDIR /install/breadbox

# This line ensures when packages are installed with Poetry a virtual environment is NOT created first. 
# You’re already in a virtual environment by using a docker image
RUN poetry config virtualenvs.create false
# Install dependencies:
RUN poetry install
RUN poetry run python --version

COPY *.py /install/breadbox
COPY bb /install/breadbox
COPY alembic /install/breadbox/alembic
COPY alembic.ini /install/breadbox
COPY breadbox /install/breadbox/breadbox
# needed by pyright
RUN mkdir -p /home/depmap 

# poetry install --without dev still does dev-dependency checks and gives error on relative path so put these directorys above working directory https://github.com/python-poetry/poetry/issues/668



