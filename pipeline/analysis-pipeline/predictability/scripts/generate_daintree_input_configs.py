import argparse
import json
import yaml
import os
import math
from typing import List, Dict, Any, Optional

# lets get CRISPR and rnai fully working before tackling the others
# screens = ["crispr", "rnai", "oncref"]
screens = ["crispr", "rnai"]

def generate_daintree_configs(
    model_config_path: str, input_config_path: str, test_only_first_n: Optional[int]
) -> List[Dict[str, Any]]:
    """
    Generate Daintree input configs for each model and screen
    Args:
        model_config_path: A yaml file that contains the configuration for the models
        input_config_path: A json file that contains the configuration for the input data
    Returns:
        List of artifacts containing the generated config information
    """
    # add a check to make sure the files exist
    if not os.path.exists(model_config_path):
        raise FileNotFoundError(f"Model config file not found: {model_config_path}")
    if not os.path.exists(input_config_path):
        raise FileNotFoundError(f"Input config file not found: {input_config_path}")

    # add a check to make sure the files are yaml and json
    if not model_config_path.endswith(".yaml"):
        raise ValueError(f"Model config file must be a yaml file: {model_config_path}")
    if not input_config_path.endswith(".json"):
        raise ValueError(f"Input config file must be a json file: {input_config_path}")

    artifacts = []

    # Load model config
    with open(model_config_path, "r") as file:
        config = yaml.safe_load(file)

    assert len(config) > 0, "Model config cannot be empty"

    # Load input config
    with open(input_config_path, "r") as file:
        input_config = json.load(file)

    assert len(input_config) > 0, "Input config cannot be empty"

    # at this time, it appears that genes and compounds use the same configurations. Generate the definitions of the model config
    # that the breadbox loader will consume
    model_configs_for_breadbox = []
    for dim_type in ['gene', 'compound']:
        per_dim_type = []
        for model_name, model_config in config.items():
            per_dim_type.append(dict(name=model_name, description=', '.join(model_config["Features"])))
        model_configs_for_breadbox.append(dict(dim_type=dim_type, configs=per_dim_type))

    # Process each model for both CRISPR and RNAi screens
    for model_name, model_config in config.items():
        for screen in screens:
            output_json = {"model_name": model_name, "screen_name": screen, "data": {}}

            # Set target based on screen type
            target = screen
            target_input = input_config[target]

            output_json["data"][target] = {
                "taiga_id": target_input["source_dataset_id"],
                "table_type": "target_matrix",
                "preprocess": "daintree_preprocess:drop_sparse_columns",
                "relation": model_config["Relation"],
            }

            # Map features to their corresponding inputs
            feature_mapping = {
                "lineage": "lineage",
                "confounder": f"{screen}_confounder",
                "driver_events": "driver_events",
                "armlevel_cn": "armlevel_cna",
                "cytoband_cn": "cytoband_cn",
                "genetic_signature": "genetic_signature",
                "mutations_hotspot": "mutations_hotspot",
                "mutations_damaging": "mutations_damaging",
                "gene_cn": "gene_cn",
                "loh": "loh",
                "rnaseq": "rnaseq",
            }

            for feature in model_config["Features"]:
                input_key = feature_mapping[feature]
                feature_input = input_config[input_key]

                # Special handling for confounder naming in output
                feature_name = feature
                if feature == "confounder":
                    feature_name = f"{screen}_confounder"

                output_json["data"][feature_name] = {
                    "taiga_id": feature_input["source_dataset_id"],
                    "table_type": feature_input["type"],
                    "dim_type": feature_input["category"],
                    "required": feature in model_config["Required"],
                    "preprocess": "daintree_preprocess:index_by_model",
                    "exempt": False,
                }

            # these values were collected by running a small number of models for each configuration
            # We'd like to target each task runs ~15 minutes to minimize loss of work due to preemption
            # while also minimizing the amount of startup work it takes to start each task
            estimated_seconds_per_model = model_config["EstimatedSecondsPerModel"]
            models_per_task = int(math.ceil((15 * 60) / estimated_seconds_per_model))

            # Generate output filename
            model_and_screen = f"{model_name}{screen}"
            output_filename = f"DaintreeInputConfig{model_and_screen}.json"

            with open(output_filename, "w") as f:
                json.dump(output_json, f, indent=2)

            artifacts.append(
                {
                    "type": "daintree_input_config",
                    "model_name": model_name,
                    "screen_name": screen,
                    "filename": {"$filename": output_filename},
                    "models_per_task": str(models_per_task),
                }
            )

    if test_only_first_n is not None:
        print(
            f"Warning: --test-only-first-n was specified so only returning the first {test_only_first_n}"
        )
        artifacts = artifacts[:test_only_first_n]

    # now write out an additional artifact which has the model configuration that breadbox requires
    with open("breadbox_model_configs.json", "wt") as fd:
        fd.write(json.dumps(model_configs_for_breadbox, indent=2))
    artifacts.append(dict(type="breadbox-model-configs", filename= {"$filename": "breadbox_model_configs.json"}))

    # Write results
    with open("results.json", "w") as f:
        json.dump({"outputs": artifacts}, f, indent=2)

    return artifacts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_config", type=str, required=True)
    parser.add_argument("--input_config", type=str, required=True)
    parser.add_argument("--test-only-first-n", type=int)
    args = parser.parse_args()
    generate_daintree_configs(
        args.model_config, args.input_config, args.test_only_first_n
    )
