import argparse
import hashlib
from pathlib import Path

from taigapy.client_v3 import UploadedFile, LocalFormat
from taigapy import create_taiga_client_v3


def get_sha256(file_path: Path) -> str:
    """Calculate the SHA256 hash of a file."""
    try:
        chunk_size = 1 * 1024 * 1024  # 1 MB
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

    except FileNotFoundError as e:
        print(f"File not found: {e}")
        raise


def update_taiga(
    dataset_id: str,
    description_of_changes: str,
    matrix_name_in_taiga: str,
    file_local_path: Path,
    file_format: str,
) -> None:
    """Update a dataset in Taiga with transformed data."""
    assert dataset_id, "Dataset ID cannot be empty"
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
            dataset_id,
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
    parser.add_argument("dataset_id", help="Taiga ID of the dataset to update")
    parser.add_argument("description_of_changes", help="Description of the changes")
    parser.add_argument("matrix_name_in_taiga", help="Name of the matrix in Taiga")
    parser.add_argument(
        "file_local_path", help="Path to the file that will be uploaded"
    )
    parser.add_argument("file_format", help="Format of the file to upload")
    args = parser.parse_args()

    tc = create_taiga_client_v3()

    existing_file_taiga_id = f"{args.dataset_id}/{args.matrix_name_in_taiga}"
    print(f"Taiga ID of the existing file: {existing_file_taiga_id}")

    # Check if the file with the same name already exists in the dataset
    if tc.get_datafile_metadata(existing_file_taiga_id) is None:
        print(
            f"File with Taiga ID {existing_file_taiga_id} does not exist. Uploading a new file."
        )
        update_taiga(
            args.dataset_id,
            args.description_of_changes,
            args.matrix_name_in_taiga,
            args.file_local_path,
            args.file_format,
        )
    else:
        # Check if the file to upload is the same as the existing file in Taiga
        file_to_upload_sha256 = get_sha256(args.file_local_path)
        print(f"SHA256 hash of the file to upload: {file_to_upload_sha256}")

        existing_file_sha256 = tc.get_datafile_metadata(
            existing_file_taiga_id
        ).original_file_sha256
        print(f"SHA256 hash of the existing file in Taiga: {existing_file_sha256}")

        if file_to_upload_sha256 == existing_file_sha256:
            print(
                "The file to upload is the same as the existing file in Taiga. Skipping the update."
            )
        else:
            # If the file to upload is different from the existing file in Taiga, update the dataset
            update_taiga(
                args.dataset_id,
                args.description_of_changes,
                args.matrix_name_in_taiga,
                args.file_local_path,
                args.file_format,
            )
