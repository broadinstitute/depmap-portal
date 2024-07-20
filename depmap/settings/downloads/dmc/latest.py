# This file was generated via running parse_yaml/to_downloads.py

# import datetime

from depmap.settings.parse_downloads import get_virtual_dataset_id_by_yaml_file_name


def get_virtual_dataset_id():
    (virtual_dataset_id, release,) = get_virtual_dataset_id_by_yaml_file_name(
        "dmc_23q4.yaml"
    )
    return virtual_dataset_id


def get_dmc_latest_release_info():
    virtual_dataset_id, release = get_virtual_dataset_id_by_yaml_file_name(
        "dmc_23q4.yaml"
    )
    release_name = "" if release is None else release.name
    release_date = (
        "" if release is None else release.get_release_date(None).strftime("%B %d %Y")
    )

    quarterly_headliners = dict()
    quarterly_headliners[release_name] = {
        "CRISPRGeneEffect.csv",
        "Model.csv",
        "OmicsExpressionProteinCodingGenesTPMLogp1.csv",
        "OmicsSomaticMutations.csv",
        "OmicsCNGene.csv",
    }

    quarterly_versions = {
        "dmc-23q4-32b7.70/CRISPRGeneEffect": "23Q4 DMC",
        "dmc-23q4-32b7.70/OmicsCNGene": "23Q4 DMC",
        "dmc-23q4-32b7.70/OmicsExpressionProteinCodingGenesTPMLogp1": "23Q4 DMC",
        "dmc-23q4-32b7.70/OmicsSomaticMutations": "23Q4 DMC",
        "dmc-23q4-32b7.70/OmicsFusionFiltered": "23Q4 DMC",
    }

    return {
        "virtual_dataset_id": virtual_dataset_id,
        "release_name": release_name,
        "release_date": release_date,
        "quarterly_headliners": quarterly_headliners,
        "quarterly_versions": quarterly_versions,
    }
