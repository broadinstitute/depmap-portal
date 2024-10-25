from taigapy.client_v3 import UploadedFile, LocalFormat
from taigapy import create_taiga_client_v3

import tempfile
import pandas as pd


def update_taiga(
    df_to_upload: pd.DataFrame,
    description_of_changes: str,
    dataset_id: str,
    matrix_name_in_taiga: str,
    file_format: str = LocalFormat.CSV_MATRIX,
) -> None:
    if file_format == "csv_table":
        file_format = LocalFormat.CSV_TABLE
    try:
        tc = create_taiga_client_v3()
        with tempfile.NamedTemporaryFile(suffix=".csv") as temp_file:
            # Save the transformed data to the temporary file
            df_to_upload.to_csv(temp_file.name)
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
