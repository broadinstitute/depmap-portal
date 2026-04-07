This directory contains the various pipelines which need to be run to get files needed by the
legacy portal loaded into GCS and the Taiga dataset updated with some derived data.

Unfortuantely, the process of running the pipeline is complicated due to the number of
dependencies it has. There's multiple layers starting with kicking off the job in jenkins:

- The "pipeline" job in jenkins is run.
- This takes the settings in jenkins and runs `pipeline/run.sh [command]`
- run.sh sets up some pre-reqs and a poetry environment and then runs the `command` within that poetry environment
- run.sh sets up _just enough_ stuff for `pipeline_runner.py` to run. This script which will do the following:
  - have conseq clean up old files from past runs
  - run pipeline via conseq
  - have conseq export a html report describing what was done
- The pipeline script will execute all conseq commands within docker container because the conseq scripts have dependencies on various tools being installed (offhand, I believe this is sparkles, gcloud and dsub, but there may be others)

One can test this all on a hermit VM by copying /etc/depmap-pipeline-runner-creds from the dev.cds.team host to that path on your vm and then running the ./run.sh script:

```
DEPMAP_DEPLOY_BRANCH=qa ./run.sh python pipeline_runner.py \
   --deploy-name iqa \
   --docker-job-name iqa-pipeline \
   --taiga-dir ~/.taiga
```

Alternatively, if you're making changes to conseq scripts, it's easiest to just cut docker out of the picture by installing all the dependencies that conseq requires and then you can just run conseq directly:

```
cd data-prep-pipeline
conseq run run_internal.conseq
```
