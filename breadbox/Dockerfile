FROM us.gcr.io/broad-achilles/depmap-breadbox-base:v2 

# install security updated
RUN apt update && apt upgrade -y


# TODO: pin python version using pyenv

# Install poetry:
RUN pip3 install poetry==1.8.2 
RUN poetry config virtualenvs.create false 

RUN mkdir /install/breadbox

# Copy files:
COPY . /install/breadbox
WORKDIR /install/breadbox

# Ensure that when packages are installed with Poetry a virtual environment is NOT created first. 
# You’re already in a virtual environment by using a docker image
RUN poetry config virtualenvs.create false
RUN poetry install 
