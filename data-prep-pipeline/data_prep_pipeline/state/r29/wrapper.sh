set -ex
cd /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r29

EXIT_STATUS=0
if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/conseq_scripts/get_release_model_and_model_condition_files/get_release_model_and_model_condition.py predictability-76d5.142/DataDictionary_20241219_160756 internal-24q2-3719.88 internal-23q4-ac2b.86 model.csv model_condition.csv model_diff.csv --readme-yaml &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/upload_to_taiga.py model.csv 'Generated model data' predictability-76d5.132 'Model' 'csv_table' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/upload_to_taiga.py model_condition.csv 'Generated model condition data' predictability-76d5.132 'ModelCondition' 'csv_table' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/upload_to_taiga.py model_diff.csv 'Generated model diff data' predictability-76d5.132 'ModelDiff' 'csv_table' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

echo $EXIT_STATUS > /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r29/retcode.txt
