import argparse
import json
import yaml
import os
from typing import List, Dict, Any

screens = ["crispr", "rnai", "oncref"]


def generate_daintree_configs(
    model_config_path: str, input_config_path: str
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

    # Process each model for both CRISPR and RNAi screens
    for model_name, model_config in config.items():
        for screen in screens:
            output_json = {"model_name": model_name, "screen_name": screen, "data": {}}

            # Set target based on screen type
            target = screen
            if screen == "crispr":
                target_key = "crispr_gene_effect"
            elif screen == "rnai":
                target_key = "rnai"
            elif screen == "oncref":
                target_key = "oncref"
            else:
                raise Exception(f"unknown: {screen}")

            target_input = input_config[target_key]

            output_json["data"][target] = {
                "taiga_id": target_input["source_dataset_id"],
                "table_type": "target_matrix",
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
                    "exempt": False,
                }

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
                    }
                )

    # Write results
    with open("results.json", "w") as f:
        # TODO: fix -- only temp change for testing. Limit to one job
        json.dump({"outputs": artifacts[:1]}, f, indent=2)

    return artifacts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_config", type=str, required=True)
    parser.add_argument("--input_config", type=str, required=True)
    args = parser.parse_args()
    generate_daintree_configs(args.model_config, args.input_config)
