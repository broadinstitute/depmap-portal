import json
from typing import Union
from taigapy import create_taiga_client_v3, LocalFormat
from taigapy.client_v3 import UploadedFile
from taigapy.format_utils import convert_csv_to_hdf5, convert_csv_to_parquet
from pathlib import Path
from dataclasses import dataclass
import argparse
import tempfile


@dataclass
class DaintreeOutputs:
    features_metadata_csv: str
    ensemble_csv: str
    predictions_matrix_csv: str


def upload_results(
    runner_config,
    outputs: DaintreeOutputs,
    dest_permaname: str,
    output_config_file: str,
):
    """
    Upload results to dataset named `dest_permaname` in Taiga and create output config file named `output_config_file`.
    """
    model_name = runner_config["model_name"]
    screen_name = runner_config["screen_name"]

    # reformat files
    features_metadata_name = f"FeatureMetadata{model_name}{screen_name}"
    features_metadata_parquqet = f"{features_metadata_name}.parquet"
    convert_csv_to_parquet(outputs.features_metadata_csv, features_metadata_parquqet)

    ensemble_name = f"Ensemble{model_name}{screen_name}"
    ensemble_parquet = f"{ensemble_name}.parquet"
    convert_csv_to_parquet(outputs.ensemble_csv, ensemble_parquet)

    predictions_matrix_name = f"Predictions{model_name}{screen_name}"
    predictions_matrix_parquet = f"{predictions_matrix_name}.hdf5"
    print("outputs.predictions_matrix_csv", outputs.predictions_matrix_csv)

    convert_csv_to_hdf5(outputs.predictions_matrix_csv, predictions_matrix_parquet)

    tc = create_taiga_client_v3()
    # Update the dataset with the transformed data
    description_of_changes = (
        f"Updated Metadata for Model: {model_name} and Screen: {screen_name}"
    )
    version = tc.update_dataset(
        dest_permaname,
        description_of_changes,
        additions=[
            UploadedFile(
                features_metadata_name,
                local_path=features_metadata_parquqet,
                format=LocalFormat.PARQUET_TABLE,
            ),
            UploadedFile(
                ensemble_name,
                local_path=ensemble_parquet,
                format=LocalFormat.PARQUET_TABLE,
            ),
            UploadedFile(
                predictions_matrix_name,
                local_path=predictions_matrix_parquet,
                format=LocalFormat.HDF5_MATRIX,
            ),
        ],
    )

    print(
        f"Updated dataset: {version.permaname} to version number: {version.version_number}"
    )

    output_config = create_output_config(
        runner_config=runner_config,
        feature_metadata_id=f"{version.permaname}.{version.version_number}/{features_metadata_name}",
        ensemble_id=f"{version.permaname}.{version.version_number}/{ensemble_name}",
        prediction_matrix_id=f"{version.permaname}.{version.version_number}/{predictions_matrix_name}",
    )

    with open(output_config_file, "w") as f:
        json.dump(output_config, f, indent=4)

    print(f"Created output config file: {output_config_file}")


def create_output_config(
    runner_config, feature_metadata_id, ensemble_id, prediction_matrix_id
):
    """Create output configuration JSON file.

    Returns:
        dict: Daintree output configuration dictionary that the portal loader is expecting
    """
    model_name = runner_config["model_name"]
    screen_name = runner_config["screen_name"]
    data = runner_config["data"]

    config = {
        model_name: {
            "input": {
                "model_name": model_name,
                "screen_name": screen_name,
                "data": data,
            },
            "output": {
                "ensemble_taiga_id": ensemble_id,
                "feature_metadata_taiga_id": feature_metadata_id,
                "prediction_matrix_taiga_id": prediction_matrix_id,
            },
        }
    }

    return config


def main():
    parser = argparse.ArgumentParser(
        description="Updates files to Taiga and writes out an output_config_file for the portal's loader"
    )
    parser.add_argument("--runner_config_file")
    parser.add_argument("--features_metadata_csv")
    parser.add_argument("--ensemble_csv")
    parser.add_argument("--predictions_matrix_csv")
    parser.add_argument("--dest_permaname")
    parser.add_argument("--output_config_file")

    args = parser.parse_args()

    with open(args.runner_config_file, "rt") as fd:
        runner_config = json.load(fd)

    upload_results(
        runner_config,
        DaintreeOutputs(
            features_metadata_csv=args.features_metadata_csv,
            ensemble_csv=args.ensemble_csv,
            predictions_matrix_csv=args.predictions_matrix_csv,
        ),
        args.dest_permaname,
        args.output_config_file,
    )


if __name__ == "__main__":
    main()
