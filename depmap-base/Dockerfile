# use the latest (at this time) LTS ubuntu version (22.04)
FROM ubuntu:jammy

# set this to avoid building image hanging due to packages prompting for configuration info
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y gnupg software-properties-common
RUN add-apt-repository -y ppa:deadsnakes/ppa 
RUN apt-get update -y && apt-get install -y vim nano joe \
    python3.9 python3.9-dev python3.9-venv sass libpq-dev graphviz
RUN apt-get update -y && apt-get install -y build-essential zlib1g-dev \
    autoconf autogen make rubygems ruby-full libtool bison flex git

# These libraries are needed for certain r packages
RUN apt-get update -y && apt-get install -y r-base \
    libcurl4-openssl-dev libssl-dev libxml2-dev libharfbuzz-dev \
    libfontconfig1-dev libfreetype6-dev libtiff5-dev libfribidi-dev

# Add dev.txt and prod.txt into the container at /requirements
# ADD requirements/dev.txt requirements/prod.txt requirements/rpy2.version /requirements/
# RUN python3.9 -m venv /python3.9 && \
#     /python3.9/bin/python -m pip install -r /requirements/dev.txt && \
#     /python3.9/bin/python -m pip install -r /requirements/prod.txt

RUN gem install sass
