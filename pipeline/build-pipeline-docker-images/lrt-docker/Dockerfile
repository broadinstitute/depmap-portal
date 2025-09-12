FROM r-base:latest

WORKDIR /app

RUN apt-get update && \
    apt-get install -y libcurl4-openssl-dev libxml2-dev \
    build-essential libssl-dev libffi-dev libfontconfig1-dev libharfbuzz-dev libfribidi-dev \
    libfreetype6-dev libpng-dev libtiff5-dev libjpeg-dev

COPY requirements-src.R .
RUN Rscript requirements-src.R
