set -ex
cd /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r32

EXIT_STATUS=0
if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/conseq_scripts/predictability/transform_driver_events.py internal-24q2-3719.88/OmicsSomaticMutations oncokb-annotated-mutations-7e2e.17/oncokb_annotated driver_events.csv &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

if [ $EXIT_STATUS == 0 ]; then
  # Propagate kill if shell receives SIGTERM or SIGINT
  trap 'kill -TERM $PID' TERM INT
  python3 /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/upload_to_taiga.py driver_events.csv 'Generated driver events data for predictability' predictability-76d5.132 'PredictabilityDriverEventsTransformed' 'csv_matrix' &
  PID=$!
  wait $PID
  trap - TERM INT
  wait $PID
  EXIT_STATUS=$?
fi

echo $EXIT_STATUS > /Users/naquib/Github/depmap-portal/data-prep-pipeline/data_prep_pipeline/state/r32/retcode.txt
