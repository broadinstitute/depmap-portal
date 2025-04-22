# This base image sets the python version to 3.9.15.
# Since we no longer depend on R, we could move away from using this custom base image. The remaining non-R dependencies may be fairly quick to install.
FROM us.gcr.io/broad-achilles/depmap-breadbox-base:v2

RUN python --version

# install security updated
RUN apt update && apt upgrade -y

RUN mkdir /install/breadbox

# Copy files:
COPY . /install/breadbox
WORKDIR /install/breadbox

# Install dependencies:
RUN pip install poetry==1.8.2 
# Ensure that when packages are installed with Poetry a virtual environment is NOT created first. 
# You’re already in a virtual environment by using a docker image
RUN poetry config virtualenvs.create false
RUN poetry install 
