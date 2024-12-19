set -ex
cd /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r36

EXIT_STATUS=0
if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/conseq_scripts/predictability/transform_crispr_confounders.py /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r30/model.csv internal-24q2-3719.88/AchievesScreenQCReport internal-24q2-3719.88/CRISPRScreensMap crispr_confounders.csv &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/upload_to_taiga.py crispr_confounders.csv 'Generated CRISPR confounders data for predictability' predictability-76d5.132 'PredictabilityCRISPRConfoundersTransformed' 'csv_matrix' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

echo $EXIT_STATUS > /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r36/retcode.txt
