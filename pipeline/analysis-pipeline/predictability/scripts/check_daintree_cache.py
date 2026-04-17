import argparse
import json
import logging
import socket
import subprocess
import os
import getpass
from datetime import datetime

import google.cloud.storage
from pydantic import BaseModel

log = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Run a command with GCS-based caching keyed on the daintree config. "
            "The cache key is derived from the config's screen_name, model_name, and target_matrix taiga_id. "
            "If a matching cache entry exists in GCS, the cached output files are restored locally and the command is skipped. "
            "If no cache entry exists, the command is run and its output files are uploaded to GCS for future reuse."
        )
    )
    parser.add_argument(
        "--expected-output",
        action="append",
        help="Name of output files to look for/restore from cache",
    )
    parser.add_argument(
        "--cache-root", help="GCS path to where cache entries are stored", required=True
    )
    parser.add_argument(
        "--no-run",
        action="store_true",
        help="If set, and no cache entry exists, fail without running command",
    )
    parser.add_argument("daintree_config", help="Path to daintree json config file")
    parser.add_argument("command", nargs="*", help="Command to run if no cache entry")

    args = parser.parse_args()
    expected_output = args.expected_output
    assert expected_output, "Missing --expected-output"

    with open(args.daintree_config, "rt") as fd:
        config = json.load(fd)

    target_matrix = None
    for name, matrix in config["data"].items():
        if matrix["table_type"] == "target_matrix":
            assert (
                target_matrix is None
            ), f"Multiple target_matrix entries found in {args.daintree_config}"
            target_matrix = matrix["taiga_id"]

    assert target_matrix, "Could not find target matrix"

    safe_target_matrix = target_matrix.replace("/", "_")
    key = f"{config['screen_name']}/{config['model_name']}/{safe_target_matrix}"
    path = f"{args.cache_root}/{key}"
    cache_entry = _restore_from_cache_entry(path, expected_output)
    if cache_entry is None:
        log.warning(f"No cache entry at {path}. Proceeding to run {args.command}")
        assert not args.no_run, f"No cache entry found at {path} and --no-run was set"
        subprocess.run(args.command, check=True)
        # if we're successful, create cache entry
        _store_cache_entry(path, expected_output, config, args.command)
    else:
        log.warning(f"Using cached result: {cache_entry}")


class CachedFile(BaseModel):
    name: str
    gcs_path: str


class CacheEntry(BaseModel):
    timestamp: str
    origin_working_dir: str
    origin_user: str
    origin_hostname: str
    daintree_config: str
    command: list[str]
    files: list[CachedFile]


class NotFound(Exception):
    pass


def _safe_get_user():
    try:
        return getpass.getuser()
    except:
        return "unknown"


def _gethostname() -> str:
    return socket.gethostname()


def _parse_gcs_path(gs_path: str):
    """Parse gs://bucket/path into (bucket, blob_path)"""
    assert gs_path.startswith("gs://"), f"Expected gs:// path, got: {gs_path}"
    without_prefix = gs_path[len("gs://") :]
    bucket, _, blob_path = without_prefix.partition("/")
    return bucket, blob_path


def _copy_from_gcs(gs_path: str, local_dest_path: str):
    """Copies from gs_path (gs://bucket/path...) to local file named local_dest_path. Throws NotFound if gs_path does not exist."""
    bucket_name, blob_path = _parse_gcs_path(gs_path)
    client = google.cloud.storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    if not blob.exists():
        raise NotFound(gs_path)
    blob.download_to_filename(local_dest_path)


def _copy_to_gcs(local_src_path: str, gs_path: str):
    """Copies local file to gs_path (gs://bucket/path...)."""
    bucket_name, blob_path = _parse_gcs_path(gs_path)
    client = google.cloud.storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_src_path)


def _restore_from_cache_entry(cache_entry_path, files_to_restore):
    try:
        _copy_from_gcs(f"{cache_entry_path}/cache_entry.json", "cache_entry.json")
    except NotFound:
        return None

    with open("cache_entry.json", "rt") as fd:
        cache_entry = CacheEntry(**json.load(fd))

    cached_names = {f.name for f in cache_entry.files}
    missing = [f for f in files_to_restore if f not in cached_names]
    assert not missing, f"Cache entry is missing expected files: {missing}"

    for file in cache_entry.files:
        _copy_from_gcs(file.gcs_path, file.name)

    return cache_entry


def _store_cache_entry(cache_entry_path, files_to_store, daintree_config, command):
    cached_files = []
    for file_to_store in files_to_store:
        dest_gcs_path = f"{cache_entry_path}/files/{file_to_store}"
        cached_files.append(CachedFile(name=file_to_store, gcs_path=dest_gcs_path))
        _copy_to_gcs(file_to_store, dest_gcs_path)
    cache_entry = CacheEntry(
        timestamp=datetime.now().isoformat(),
        origin_working_dir=os.getcwd(),
        origin_user=_safe_get_user(),
        origin_hostname=_gethostname(),
        daintree_config=json.dumps(daintree_config),
        command=command,
        files=cached_files,
    )
    with open("cache_entry.json", "wt") as fd:
        fd.write(cache_entry.model_dump_json(indent=2))
    _copy_to_gcs("cache_entry.json", f"{cache_entry_path}/cache_entry.json")
    return cache_entry


if __name__ == "__main__":
    main()
