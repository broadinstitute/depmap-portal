set -ex
cd /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r17

EXIT_STATUS=0
if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/conseq_scripts/predictability/transform_genetic_derangement.py /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r1/cngene_log2.csv /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r3/hgnc_gene_table.csv genetic_derangement.csv &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 upload_to_taiga.py genetic_derangement.csv 'Generated genetic derangement data for predictability' predictability-76d5.132 'PredictabilityGeneticDerangementTransformed' 'csv_matrix' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

echo $EXIT_STATUS > /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r17/retcode.txt
