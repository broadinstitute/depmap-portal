import tempfile
import pandas as pd
import argparse

from taigapy.client_v3 import UploadedFile, LocalFormat
from taigapy import create_taiga_client_v3


def update_taiga(
    df_to_upload: pd.DataFrame,
    description_of_changes: str,
    dataset_id: str,
    matrix_name_in_taiga: str,
    file_format: str,
) -> None:
    if file_format == "csv_table":
        file_format = LocalFormat.CSV_TABLE
    elif file_format == "csv_matrix":
        file_format = LocalFormat.CSV_MATRIX
    try:
        tc = create_taiga_client_v3()
        with tempfile.NamedTemporaryFile(suffix=".csv") as temp_file:
            # Only keep the dataframe index for matrix datasets
            keep_index = file_format == LocalFormat.CSV_MATRIX
            # Save the transformed data to the temporary file
            df_to_upload.to_csv(temp_file.name, index=keep_index)
            temp_filename = temp_file.name

            # Update the dataset with the transformed data
            version = tc.update_dataset(
                dataset_id,
                description_of_changes,
                additions=[
                    UploadedFile(
                        matrix_name_in_taiga,
                        local_path=temp_filename,
                        format=file_format,
                    )
                ],
            )
            print(
                f"Updated dataset: {version.permaname} to version number: {version.version_number}"
            )
    except Exception as e:
        print(f"Error updating Taiga: {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Update Taiga dataset with transformed data."
    )
    parser.add_argument("df_to_upload", help="Path to the file that will be uploaded")
    parser.add_argument("description_of_changes", help="Description of the changes")
    parser.add_argument("dataset_id", help="Taiga ID of the dataset to update")
    parser.add_argument("matrix_name_in_taiga", help="Name of the matrix in Taiga")
    parser.add_argument("file_format", help="File format of the data to upload")

    args = parser.parse_args()
    df = pd.read_csv(args.df_to_upload)
    dataset_id = args.dataset_id.split(".")[0]
    update_taiga(
        df,
        args.description_of_changes,
        dataset_id,
        args.matrix_name_in_taiga,
        args.file_format,
    )
