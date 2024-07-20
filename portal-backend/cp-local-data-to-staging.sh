#!/bin/bash
set -e

if [ ! -e webapp_data/data.db ] ; then 
    ln -s dev.db webapp_data/data.db
fi

rsync -avc webapp_data/ ubuntu@dev.cds.team:/data1/depmap/deploy-data/
#ssh ubuntu@depmap.org 'mv /data1/depmap/data/dev.db /data1/depmap/data/data.db && cp /data1/depmap/data/data.db /data1/depmap/data/data.db.last-copy-to-staging'
