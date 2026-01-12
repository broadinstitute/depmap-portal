import argparse
from pathlib import Path

from taigapy.client_v3 import UploadedFile, LocalFormat
from taigapy import create_taiga_client_v3


def update_taiga(
    dataset_permaname: str,
    description_of_changes: str,
    matrix_name_in_taiga: str,
    file_local_path: Path,
    file_format: str,
) -> None:
    """Update a dataset in Taiga with transformed data."""
    assert dataset_permaname, "Dataset permaname cannot be empty"
    assert description_of_changes, "Description of changes cannot be empty"
    assert matrix_name_in_taiga, "Matrix name in Taiga cannot be empty"
    assert file_local_path, "File path cannot be empty"
    assert file_format, "File format cannot be empty"

    if file_format == "csv_table":
        file_format = LocalFormat.CSV_TABLE
    elif file_format == "csv_matrix":
        file_format = LocalFormat.CSV_MATRIX
    try:
        tc = create_taiga_client_v3()
        # Update the dataset with the transformed data
        version = tc.update_dataset(
            dataset_permaname,
            description_of_changes,
            additions=[
                UploadedFile(
                    matrix_name_in_taiga,
                    local_path=file_local_path,
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
    parser.add_argument("release_permaname", help="Release permaname")
    parser.add_argument("description_of_changes", help="Description of the changes")
    parser.add_argument("matrix_name_in_taiga", help="Name of the matrix in Taiga")
    parser.add_argument(
        "file_local_path", help="Path to the file that will be uploaded"
    )
    parser.add_argument("file_format", help="Format of the file to upload")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    dataset_permaname = args.release_permaname
    print(f"Release dataset permaname is: {dataset_permaname}")

    update_taiga(
        dataset_permaname,
        args.description_of_changes,
        args.matrix_name_in_taiga,
        args.file_local_path,
        args.file_format,
    )
