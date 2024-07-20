from flask import current_app
from urllib.parse import quote
import logging


log = logging.getLogger(__name__)


def get_taiga_id_parts(taiga_id):
    if "." in taiga_id:
        dataset, version = taiga_id.split(".", 1)
    else:
        dataset = taiga_id
        version = None
        file = None
        return dataset, version, file
    if "/" in version:
        version, file = version.split("/", 1)
    else:
        file = None
    return dataset, version, file


def get_taiga_client():
    from taigapy import create_taiga_client_v3

    cache_dir = current_app.config["TAIGA_CACHE_DIR"]

    return create_taiga_client_v3(cache_dir=cache_dir)


def get_taiga_url(taiga_id):
    dataset, version, _ = get_taiga_id_parts(taiga_id)
    return "https://cds.team/taiga/dataset/" + quote(dataset) + "/" + quote(version)


def check_taiga_datafile_valid(taiga_id: str, allow_deprecated: bool = False) -> bool:
    tc = get_taiga_client()

    try:
        dataset, version, _ = get_taiga_id_parts(taiga_id)
        dataset_version_metadata = tc.get_dataset_metadata(dataset, version)
    except Exception:
        log.error(f"Failed to fetch metadata for {taiga_id}")
        raise

    if dataset_version_metadata is None:
        return False

    if "datasetVersion" not in dataset_version_metadata:
        return False

    dataset_version_state = dataset_version_metadata["datasetVersion"]["state"]

    if allow_deprecated:
        return dataset_version_state in {"approved", "deprecated"}

    return dataset_version_state == "approved"
