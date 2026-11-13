import argparse
import json
import os
import sys
from glob import glob
from typing import Optional

DAINTREE_CORE_BIN_PATH = "daintree-core"


def _find_taiga_token():
    search_path = [".taiga-token", f"{os.environ['HOME']}/.taiga/token"]
    for path in search_path:
        if os.path.exists(path):
            return path
    raise Exception(f"Could not find taiga token. Checked for it in: {search_path}")


def create_sparkles_workflow(
    config: str,
    out: Optional[str],
    test: bool,
    nfolds: int,
    ncpus: int,
    models_per_task: int,
    test_first_n_tasks: Optional[int],
    norm_permutations: int,
    extra_python_files: Optional[str],
    select_n_features: int,
    filter: Optional[str],
):
    # Build prepare command with optional python-path arguments

    # I worry about the random names that
    extra_python_path_dir = "extra_python_files"

    python_path_parameter = []
    python_files_to_localize = []
    if extra_python_files:
        for filename in glob(f"{extra_python_files}/*.py"):
            python_files_to_localize.append(
                {
                    "src": filename,
                    "dst": os.path.join(
                        extra_python_path_dir, os.path.basename(filename)
                    ),
                }
            )
        python_path_parameter = [
            "--python-path",
            extra_python_path_dir,
        ]

    prepare_command = ["daintree-runner"] + python_path_parameter

    prepare_command.extend(
        [
            "prepare-and-partition",
            "--input-config",
            "model_config.json",
            "--out",
            "out",
            "--models-per-task",
            str(models_per_task),
        ]
    )
    if filter:
        prepare_command.extend(["--filter", filter])
    if test_first_n_tasks:
        prepare_command.extend(["--test-first-n-tasks", str(test_first_n_tasks)])
    if test:
        prepare_command.append("--test")

    # Build fit-model command with optional python-path arguments
    fit_model_command = [DAINTREE_CORE_BIN_PATH] + python_path_parameter
    fit_model_command.extend(
        [
            "fit-model",
            "--x",
            "out/X.ftr",
            "--y",
            "out/target_matrix_filtered.ftr",
            "--model-config",
            "out/core_model_config.yaml",
            "--n-folds",
            str(nfolds),
            "--cpus",
            str(ncpus),
            "--select-n-features",
            str(select_n_features),
            "--target-range",
            "{parameter.start_index}",
            "{parameter.end_index}",
            "--model",
            "{parameter.model_name}",
        ]
    )

    # Build calc-feature-imp-norm command (computes the norm for every model in the config)
    norm_command = [DAINTREE_CORE_BIN_PATH] + python_path_parameter
    norm_command.extend(
        [
            "calc-feature-imp-norm",
            "--x",
            "out/X.ftr",
            "--y",
            "out/target_matrix_filtered.ftr",
            "--model-config",
            "out/core_model_config.yaml",
            "--r",
            str(norm_permutations),
            "--output",
            "model_norms.json",
            "--target-chunk-size",
            "200",
        ]
    )

    taiga_token = _find_taiga_token()

    # Build paths_to_localize including python-path directories
    paths_to_localize = [
        {"src": taiga_token, "dst": ".taiga-token"}
    ] + python_files_to_localize

    workflow = {
        "paths_to_localize": paths_to_localize,
        "steps": [
            {
                "command": prepare_command,
                "paths_to_localize": [{"src": config, "dst": "model_config.json"}],
            },
            {
                "command": fit_model_command,
                "parameters_csv": "{step.1.job_path}/1/out/partitions.csv",
                "paths_to_localize": [{"src": "{step.1.job_path}/1/out", "dst": "out"}],
            },
            {
                "command": [
                    "daintree-runner",
                    "gather",
                    "--dir",
                    "{step.2.job_path}",
                    "{step.1.job_path}/1/out/partitions.csv",
                ]
            },
            {
                "command": norm_command,
                "paths_to_localize": [{"src": "{step.1.job_path}/1/out", "dst": "out"}],
            },
        ],
        "write_on_completion": [
            {
                "expression": {
                    "filename": "outputs.json",
                    "sparkles_job_name": "{step.1.job_name}",
                    "features_metadata_path": "{step.1.job_path}/1/out/feature_metadata.csv",
                    "ensemble_path": "{step.3.job_path}/1/ensemble.csv",
                    "predictions_path": "{step.3.job_path}/1/predictions.csv",
                    "feature_imp_norms_path": "{step.4.job_path}/1/model_norms.json",
                },
                "filename": "daintree-output.json",
            },
        ],
    }
    workflow_json = json.dumps(workflow, indent=2)

    if out:
        print(f"writing workflow to {out}")
        with open(out, "wt") as fd:
            fd.write(workflow_json)
    else:
        print(workflow_json)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a sparkles workflow for running daintree"
    )

    parser.add_argument(
        "--config", help="Path to the json daintree model config file", required=True
    )

    parser.add_argument(
        "--out", help="Path to write workflow to. If not specified, writes to stdout"
    )

    parser.add_argument("--nfolds", default=5, type=int)
    parser.add_argument("--ncpus", default=1, type=int)

    parser.add_argument(
        "--models-per-task",
        default=10,
        type=int,
        help="The number of models to fit per each sparkles task",
    )

    parser.add_argument(
        "--test-first-n-tasks",
        type=int,
        help="If set, will only run a max of N tasks (for testing)",
    )

    parser.add_argument(
        "--test",
        action="store_true",
        help="Run a test run (subsetting the data to make a fast, but incomplete, run)",
    )

    parser.add_argument(
        "--norm-permutations",
        default=10,
        type=int,
        help="Number of null permutations (R) used by calc-feature-imp-norm",
    )
    parser.add_argument(
        "--extra-python-files",
        help="Path to directory which contains transforms that daintree will use",
    )

    parser.add_argument(
        "--select-n-features",
        help="How many top correlates to consider in feature selection",
        type=int,
        default=1000,
    )
    parser.add_argument("--filter", help="Filter the columns by the given regex")

    args = parser.parse_args()
    create_sparkles_workflow(
        config=args.config,
        out=args.out,
        test=args.test,
        nfolds=args.nfolds,
        ncpus=args.ncpus,
        models_per_task=args.models_per_task,
        test_first_n_tasks=args.test_first_n_tasks,
        norm_permutations=args.norm_permutations,
        extra_python_files=args.extra_python_files,
        select_n_features=args.select_n_features,
        filter=args.filter,
    )


if __name__ == "__main__":
    main()
