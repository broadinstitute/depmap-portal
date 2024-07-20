import argparse
import numpy as np
from taigapy import create_taiga_client_v3
from taigapy.client_v3 import UploadedFile, LocalFormat
import tempfile


def transform_cngene_to_log2_and_upload_to_taiga(cngene_dataset_id):
    """Transform CN gene expression data to log2 scale and upload to Taiga

    Args:
        cngene_dataset_id (pd.DataFrame): The dataset id of the CN gene expression data
        output_filename (str): The filename to save the transformed data to locally
    """
    taiga_client = create_taiga_client_v3()
    # Get the CN gene expression data
    print("Getting CN gene expression data...")
    cngene_expression_data = taiga_client.get(cngene_dataset_id)
    # Transform the CN gene expression data to log2 scale
    print("Transforming CN gene expression data to log2 scale...")
    log2_transformed_data = np.log2(cngene_expression_data + 1)

    # Create a temporary file
    with tempfile.NamedTemporaryFile(suffix=".csv") as temp_file:
        # Save the transformed data to the temporary file
        log2_transformed_data.to_csv(temp_file.name)
        temp_filename = temp_file.name

        # Get the taiga permaname (e.g. internal-23q4-ac2b) from the dataset id
        taiga_permaname = cngene_dataset_id.split(".")[0]
        print(f"Taiga permaname: {taiga_permaname}")

        # Update the dataset with the transformed data
        version = taiga_client.update_dataset(
            taiga_permaname,
            "Transformed CN gene expression data to log2 scale",
            additions=[
                UploadedFile(
                    "PortalOmicsCNGeneLog2",
                    local_path=temp_filename,
                    format=LocalFormat.CSV_MATRIX,
                )
            ],
        )
        print(
            f"Updated dataset: {version.permaname} to version number: {version.version_number}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Transform CN gene expression data to log2 scale."
    )
    parser.add_argument("cngene_dataset_id")
    args = parser.parse_args()
    transform_cngene_to_log2_and_upload_to_taiga(args.cngene_dataset_id)
