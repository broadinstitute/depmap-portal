import datetime
import hashlib
import os
import uuid
from typing import List, Optional

from fastapi import HTTPException
from itsdangerous.url_safe import URLSafeSerializer


def _get_temp_filename():
    "create a unique filename prefixed by date as per the convention we use for the /results directory"
    filename = f"{datetime.datetime.now().strftime('%Y%m%d')}/{uuid.uuid4()}/upload"
    return filename


def _ensure_parent_dir_exists(path):
    "make sure the parent directory for this path exists, creating if necessary"
    parent = os.path.dirname(path)
    os.makedirs(parent, exist_ok=True)
    assert os.path.isdir(parent), f"{parent} is not a directory"


def _concatenate_files(source_filenames, dest_filename, expected_md5: Optional[str]):
    hasher = hashlib.md5()
    with open(dest_filename, "wb") as dest_fd:
        for source_filename in source_filenames:
            with open(source_filename, "rb") as src_fd:

                # copy data and compute md5 hash while doing copy
                while True:
                    buffer = src_fd.read(1024 * 1024)
                    if len(buffer) == 0:
                        break
                    dest_fd.write(buffer)
                    hasher.update(buffer)

    computed_hash = hasher.hexdigest()
    if expected_md5:
        if expected_md5 != computed_hash:
            raise HTTPException(
                400, f"Expected md5 hash {expected_md5} but got {computed_hash}"
            )


def construct_file_from_ids(
    file_ids: List[str],
    expected_md5: Optional[str],
    serializer: URLSafeSerializer,
    compute_results_location: str,
):
    "construct a new file from a list of file_ids (signed filepaths) and return the path to that file"
    source_filenames = []
    for file_id in file_ids:
        filename = serializer.loads(file_id)
        full_path = os.path.join(compute_results_location, filename)
        assert os.path.exists(
            full_path
        ), f"{full_path} came from a signed path, but it does not exist"
        source_filenames.append(full_path)

    dest_filename = os.path.join(compute_results_location, _get_temp_filename())
    _ensure_parent_dir_exists(dest_filename)

    _concatenate_files(source_filenames, dest_filename, expected_md5)

    return dest_filename
