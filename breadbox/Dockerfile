# TODO: where does this image come from?
FROM us.gcr.io/broad-achilles/depmap-breadbox-base:v2 

# install security updated
RUN apt update && apt upgrade -y

# TODO: update this poetry setup to be more like the portal backend and other repos, seems unnecessarily complex
# TODO: pin python version using pyenv

# Install poetry:
RUN pip3 install poetry==1.8.2 
RUN poetry config virtualenvs.create false 

RUN mkdir /install/breadbox

# Copy files:
COPY . /install/breadbox

# TODO: pyright errors still differ, even with the same python version! 
# TODO: I simplified it a bunch but now it's hitting maybe-nondeterministic failures. Why? I should look back at the old changes

# TOOD: why does this need the breadbox client at all? is it for some github action?

# put in place the minimal pythons file so that we can run poetry install at this point
# then if any *.py file, docker can reuse the old layers. (Just make sure that
# COPY *.py and COPY breadbox ... are all after `poetry install`. Poetry install doesn't
# need them, and poetry install does take some time.
# COPY breadbox-client /install/breadbox-client
# RUN mkdir -p /install/breadbox/breadbox && echo '# stubbing out this file just so we can run poetry install (just an optimization for rebuilding docker image faster after code changes)' > /install/breadbox/breadbox/__init__.py

WORKDIR /install/breadbox

# This line ensures when packages are installed with Poetry a virtual environment is NOT created first. 
# You’re already in a virtual environment by using a docker image
RUN poetry config virtualenvs.create false
# Install dependencies:
RUN poetry run python --version
RUN ls
# TODO: debug why this is failing now
RUN poetry install 
