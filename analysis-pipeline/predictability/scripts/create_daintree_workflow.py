import json
import argparse
from typing import Optional
import os

def create_sparkles_workflow(config: str, out: Optional[str], test: bool, nfolds: int, models_per_task: int, test_first_n_tasks:Optional[int]):
    prepare_command = [
                    "daintree-runner",
                    "prepare-and-partition",
                    "--input-config",
                    "model_config.json",
                    "--out",
                    "out",
                    "--models-per-task",
                    str(models_per_task)
                ] + (["--test-first-n-tasks", str(test_first_n_tasks)] if test_first_n_tasks else [])
    if test:
        prepare_command.append("--test")

    taiga_token = _find_taiga_token()

    workflow = {
        "paths_to_localize": [
        {"src": taiga_token, "dst":".taiga-token"}
        ],
        "steps": [
            {
                "command": prepare_command,
                "paths_to_localize": [{"src": config, "dst":"model_config.json"}],
            },
            {
                "command": ["daintree-core", "fit-model", "--x", "out/X.ftr", "--y", "out/target_matrix.ftr", "--model-config", "{parameter.model_config}", "--n-folds", str(nfolds), "--target-range", "{parameter.start_index}", "{parameter.end_index}", "--model", "{parameter.model_name}"],
                "parameters_csv": "{step.1.job_path}/1/out/partitions.csv",
                  "paths_to_localize": [
                    {"src": "{step.1.job_path}/1/out", "dst":"out"}
                ]
            },
            {"command": ["daintree-runner", "gather", "--dir", "{step.2.job_path}", "{step.1.job_path}/1/out/partitions.csv"]},
        ],
        "write_on_completion": [
            {
                "expression": {
                    "sparkles_job_name": "{step.1.job_name}",
                    "features_metadata_path": "{step.1.job_path}/1/out/feature_metadata.csv",
                    "ensemble_path":
                                "{step.3.job_path}/1/ensemble.csv",
                    "predictions_path": 
                                "{step.3.job_path}/1/predictions.csv"},
                "filename": "daintree-output.json"
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


def _find_taiga_token():
    search_path = [".taiga-token", f"{os.environ['HOME']}/.taiga/token"]
    for path in search_path:
        if os.path.exists(path):
            return path
    raise Exception(f"Could not find taiga token. Checked for it in: {search_path}")
import argparse

def main():
    parser = argparse.ArgumentParser(description="Your script description here")
    
    parser.add_argument(
        "--config",
        help="Path to the json daintree model config file",
        required=True
    )
    
    parser.add_argument(
        "--out",
        help="Path to write workflow to. If not specified, writes to stdout"
    )
    
    parser.add_argument(
        "--nfolds",
        default=5,
        type=int
    )
    
    parser.add_argument(
        "--models-per-task",
        default=10,
        type=int,
        help="The number of models to fit per each sparkles task"
    )
    
    parser.add_argument(
        "--test-first-n-tasks",
        type=int,
        help="If set, will only run a max of N tasks (for testing)"
    )
    
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run a test run (subsetting the data to make a fast, but incomplete, run)"
    )
    
    args = parser.parse_args()
    create_sparkles_workflow(config=args.config, 
                             out=args.out, 
                             test=args.test, nfolds=args.nfolds, 
                             models_per_task=args.models_per_task, 
                             test_first_n_tasks=args.test_first_n_tasks)
    
if __name__ == "__main__":
    main()
