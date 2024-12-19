set -ex
cd /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r24

EXIT_STATUS=0
if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/conseq_scripts/predictability/transform_fusion.py internal-24q2-3719.88/OmicsFusionFiltered /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r3/hgnc_gene_table.csv fusion.csv &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 upload_to_taiga.py fusion.csv 'Generated fusion data for predictability' predictability-76d5.132 'PredictabilityFusionTransformed' 'csv_matrix' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

echo $EXIT_STATUS > /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r24/retcode.txt
