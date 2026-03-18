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
class DaintreeOutput:
    actuals_name: str
    config_name: str
    ensemble_csv: str
    predictions_matrix_csv: str

@dataclass
class UploadResult:
    actuals_name: str
    config_name: str
    ensemble_taiga_id: str
    predictions_matrix_taiga_id: str


def _to_camel(_parts):
    parts = []
    for x in _parts:
        parts.extend(x.lower().split("_"))
    return ''.join([x[0].upper()+x[1:] for x in parts])

def upload_results(
    output: DaintreeOutput,
    dest_permaname: str,
):
    """
    Upload results to dataset named `dest_permaname` in Taiga.
    """
    assert dest_permaname is not None
    
    ensemble_name = _to_camel(["daintree", "output", output.actuals_name, output.config_name])
    ensemble_parquet = f"{ensemble_name}.parquet"
    convert_csv_to_parquet(output.ensemble_csv, ensemble_parquet)

    predictions_matrix_name = _to_camel(["daintree", "predictions", output.actuals_name, output.config_name])
    predictions_matrix_parquet = f"{predictions_matrix_name}.hdf5"
    convert_csv_to_hdf5(output.predictions_matrix_csv, predictions_matrix_parquet)

    tc = create_taiga_client_v3()
    # Update the dataset with the transformed data
    description_of_changes = (
        f"Uploading {ensemble_name} and {predictions_matrix_name} (via upload_fit_results_to_taiga.py)"
    )
    print(description_of_changes)
    assert dest_permaname is not None and dest_permaname != "None"
    version = tc.update_dataset(
        dest_permaname,
        description_of_changes,
        additions=[
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

    return UploadResult(
        actuals_name=output.actuals_name,
        config_name=output.config_name,
        ensemble_taiga_id=f"{version.permaname}.{version.version_number}/{ensemble_name}",
        predictions_matrix_taiga_id=f"{version.permaname}.{version.version_number}/{predictions_matrix_name}"
    )

def main():
    parser = argparse.ArgumentParser(
        description="Updates files to Taiga and writes out an output_config_file for the portal's loader"
    )
    parser.add_argument("--actuals")
    parser.add_argument("--actuals_taiga_id")
    parser.add_argument("--config")
    parser.add_argument("--ensemble_csv")
    parser.add_argument("--predictions_matrix_csv")
    parser.add_argument("--dest_permaname")

    args = parser.parse_args()

    result = upload_results(
        DaintreeOutput(
            actuals_name=args.actuals,
            config_name=args.config,
            ensemble_csv=args.ensemble_csv,
            predictions_matrix_csv=args.predictions_matrix_csv,
        ),
        args.dest_permaname,
    )
    with open("results.json", "wt") as fd:
        fd.write(json.dumps(dict(outputs=[
            dict(type="breadbox-daintree-output",
                 actuals_name=result.actuals_name,
                 actuals_taiga_id=args.actuals_taiga_id,
                 config_name=result.config_name,
                 ensemble_taiga_id = result.ensemble_taiga_id,
                 predictions_matrix_taiga_id = result.predictions_matrix_taiga_id
                 )
            ])))


if __name__ == "__main__":
    main()
