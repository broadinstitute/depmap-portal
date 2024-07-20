#!/bin/bash

DEPMAP_ENV=istaging

set -ex
rm -rf webapp_data
mkdir webapp_data
gsutil rsync -x '.*-cor.*sqlite3' -r gs://broad-achilles-kubeque/depmap-pipeline/depmap-test-rep-final-db/1/data webapp_data

#rsync --progress --exclude results --exclude '*-cor*sqlite3' -avc "ubuntu@dev.cds.team:/data2/depmap/${DEPMAP_ENV}/data/" webapp_data/
cat <<EOF
delete from correlated_dataset;
delete from col_nonstandard_matrix_index_write_only where owner_id != 0;
delete from row_nonstandard_matrix_index_write_only where owner_id != 0;
delete from nonstandard_matrix_write_only where owner_id != 0;
delete from nonstandard_private_dataset_metadata_write_only where owner_id != 0;
EOF

cat tmp.sql | sqlite3 webapp_data/data.db 

echo 'clobbering flask with version which sets DEPMAP_ENV=${DEPMAP_ENV}'
cat >flask <<EOF
#!/usr/bin/env bash
source setup_env.sh
export DEPMAP_ENV=${DEPMAP_ENV}
export CONFIG_PATH=../config/skyros/settings.py
export DEPMAP_OVERRIDES=./overrides.py
if [[ "\$1" == "run" ]] ; then
  shift
  exec flask run --without-threads "\$@"
else
  exec flask "\$@"
fi
EOF

