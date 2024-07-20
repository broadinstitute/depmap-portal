#!/usr/bin/bash

ssh ubuntu@cds.team sudo chown -R ubuntu /data2/depmap/deploy-data
eval `ssh-agent`
ssh-add -K
ssh -A dev.cds.team rsync -avc --progress /data2/depmap/data/ ubuntu@cds.team:/data2/depmap/deploy-data/
eval `ssh-agent -k`

