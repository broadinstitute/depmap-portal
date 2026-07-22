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

## `run.sh` reference

A thin wrapper whose only job is to prepare the host environment and then hand off to a
docker container (`poetry run "$@"` is run inside the container, so any command line
arguments passed to `run.sh` are just forwarded to `poetry run` inside the container —
typically `python pipeline_runner.py ...`).

Steps it performs:

1. Resolves `SCRIPT_HOME` (this directory) and `REPO_ROOT` (the top of the monorepo checkout).
2. Sources `.env` in this directory if present, so local overrides don't need to be exported manually.
3. Validates required environment variables are set, exiting with an error if any are missing:
   - `DOCKER_CONTAINER_NAME` — name to give the docker container that gets started
   - `GOOGLE_APPLICATION_CREDENTIALS` — path to a GCP service account key file, mounted into the container
   - `DEPMAP_DEPLOY_BRANCH` — branch of `depmap-deploy` to check out (contains non-public conseq files/config)
4. Defaults `SPARKLES_HOME` to `$HOME/.sparkles-cache` and `TAIGA_HOME` to `$HOME/.taiga` if not already set.
5. Clones (or pulls, if already checked out) the `depmap-deploy` repo into `REPO_ROOT`, then checks out `$DEPMAP_DEPLOY_BRANCH`.
6. Sources `image-name` to get the `$DOCKER_IMAGE` tag to run.
7. `chown`s the repo so file permissions are sane before/after the container runs (the container runs as root, so files it creates need to be handed back to the `ubuntu` user).
8. Starts the docker container with `docker run`, mounting:

   - `${REPO_ROOT}` at the same path inside the container
   - `${SPARKLES_HOME}` → `/root/.sparkles-cache`
   - `${GOOGLE_APPLICATION_CREDENTIALS}` at the same path inside the container
   - `${TAIGA_HOME}` → `/root/.taiga`

   and runs `poetry run "$@"` inside it, with the working directory set to `$SCRIPT_HOME` (i.e. `pipeline/`).

Usage:

```
DEPMAP_DEPLOY_BRANCH=<branch> DOCKER_CONTAINER_NAME=<name> GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json> \
  ./run.sh <command to run inside the poetry env, e.g. python pipeline_runner.py ...>
```

## `pipeline_runner.py` reference

Defines `PipelineRunner`, the single class used to drive a `conseq` run. It used to be
subclassed per-pipeline (e.g. `DataPrepPipelineRunner` / `PreprocessingPipelineRunner`,
still referenced by `run_pipelines_jenkins.sh`), but that's been consolidated back into
this one class — `main()` just instantiates `PipelineRunner` directly.

### Command line arguments

| Argument        | Required | Description                                                                                                                                                                                                                                   |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--deploy-name` | yes      | Name of the environment being deployed to (e.g. `iqa`, `dqa`, `xqa`). Mapped internally (see `map_environment_name`) to the conseq filename suffix (`internal`, `dmc`, `external`).                                                           |
| `--working-dir` | yes      | Directory containing the `run_<env>.conseq` file for the pipeline being run (e.g. `analysis-pipeline/`).                                                                                                                                      |
| `--destination` | no       | GCS path to publish results to. If set, publishing is enabled: an override conseq file is generated that injects this as `publish_dest`, and the destination is wiped before the run so it only ever contains artifacts from the current run. |
| `--staging-url` | no       | GCS path conseq uses to stage its CAS (content-addressable storage) objects. Defaults to `gs://preprocessing-pipeline-outputs/conseq/depmap`.                                                                                                 |
| `--start-with`  | no       | A GCS path to an existing conseq export to seed the run's state from, instead of starting from scratch.                                                                                                                                       |
| `--export-path` | no       | If set, `conseq export` is run against this path after the pipeline finishes.                                                                                                                                                                 |
| `--dryrun`      | no       | Print the commands that would run instead of executing them (GCS deletes are also skipped).                                                                                                                                                   |
| `conseq_args`   | no       | Any remaining positional args are passed straight through to the final `conseq run` invocation.                                                                                                                                               |

### What `run()` does

1. Builds a `CommonConfig` (`pipeline_config.py`) from the parsed args.
2. If `--start-with` was given, downloads the specified conseq export from GCS (using the
   `depmap-pipeline-runner` service account) and replays it with `conseq run downloaded-export.conseq`, then runs `conseq forget --regex publish.*` so publish rules
   re-run against the new state.
3. Resolves the conseq file to run — `<working-dir>/run_<mapped-env>.conseq` — generating a
   `.patched` override copy (via `create_override_conseq_file`) when `--destination` is set,
   to inject `publish_dest`/`S3_STAGING_URL` into the file.
4. Runs `conseq gc` to clean up unused directories from past runs.
5. Deletes everything currently under `publish_dest` in GCS and runs `conseq forget --regex publish.*`, so a stale artifact that's no longer produced by the pipeline can't survive
   under the hood — the destination will only ever reflect what this specific run produced.
6. Runs the main `conseq run` command (with `--no-reattach --remove-unknown-artifacts --maxfail 20`, plus `-D` overrides for `sparkles_path`, `is_dev`, `S3_STAGING_URL`, and
   `publish_dest`/`publish_data_prep`).
7. Runs post-run tasks: `conseq report html`, then reads a `*-DO-NOT-EDIT-ME` file out of
   `working_dir` to extract `RELEASE_TAIGA_ID` and logs it (`log_dataset_usage`) for dataset
   usage tracking; if `--export-path` was given, also runs `conseq export`.
8. Exits with the exit status of the main `conseq run` command.
