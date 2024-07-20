# This file was generated via running parse_yaml/to_downloads.py

# import datetime

from depmap.settings.parse_downloads import get_virtual_dataset_id_by_yaml_file_name


def get_virtual_dataset_id():
    (virtual_dataset_id, release,) = get_virtual_dataset_id_by_yaml_file_name(
        "internal_23q4.yaml"
    )
    return virtual_dataset_id


def get_internal_latest_release_info():
    virtual_dataset_id, release = get_virtual_dataset_id_by_yaml_file_name(
        "internal_23q4.yaml"
    )
    release_name = "" if release is None else release.name
    release_date = (
        "" if release is None else release.get_release_date(None).strftime("%B %d %Y")
    )

    quarterly_headliners = dict()
    quarterly_headliners[release_name] = {
        "OmicsSomaticMutations.csv",
        "OmicsExpressionProteinCodingGenesTPMLogp1.csv",
        "CRISPRGeneEffect.csv",
        "OmicsCNGene.csv",
        "Model.csv",
    }

    quarterly_versions = {
        "internal-23q4-ac2b.67/CRISPRGeneEffect": "23Q4 Internal",
        "internal-23q4-ac2b.67/OmicsCNGene": "23Q4 Internal",
        "internal-23q4-ac2b.67/OmicsExpressionProteinCodingGenesTPMLogp1": "23Q4 Internal",
        "internal-23q4-ac2b.67/OmicsSomaticMutations": "23Q4 Internal",
        "internal-23q4-ac2b.67/OmicsFusionFiltered": "23Q4 Internal",
    }

    return {
        "virtual_dataset_id": virtual_dataset_id,
        "release_name": release_name,
        "release_date": release_date,
        "quarterly_headliners": quarterly_headliners,
        "quarterly_versions": quarterly_versions,
    }
