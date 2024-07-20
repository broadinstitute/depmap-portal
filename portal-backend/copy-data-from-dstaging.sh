#!/bin/bash

DEPMAP_ENV=dstaging

set -ex

rm -rf webapp_data
rsync --progress --exclude results --exclude '*private*' --exclude '*-cor*sqlite3' -avc "ubuntu@dev.cds.team:/data2/depmap/${DEPMAP_ENV}/data/" webapp_data/
echo 'delete from correlated_dataset;' | sqlite3 webapp_data/data.db

echo 'clobbering flask with version which sets DEPMAP_ENV=${DEPMAP_ENV}'
cat >flask <<EOF
#!/usr/bin/env bash
source setup_env.sh
export DEPMAP_ENV=${DEPMAP_ENV}
export CONFIG_PATH=../config/dmc/settings.py
export DEPMAP_OVERRIDES=./overrides.py
if [[ "\$1" == "run" ]] ; then
  shift
  exec flask run --without-threads "\$@"
else
  exec flask "\$@"
fi
EOF

