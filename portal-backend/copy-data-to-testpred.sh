#!/bin/bash

DEPMAP_ENV=testpred

set -ex

rsync --progress --exclude results --exclude '*private*' --exclude '*-cor*sqlite3' -avc webapp_data/ "ubuntu@dev.cds.team:/data2/depmap/${DEPMAP_ENV}/data/"
ssh ubuntu@dev.cds.team "echo \"delete from correlated_dataset;\" | sqlite3 /data2/depmap/${DEPMAP_ENV}/data/data.db"

