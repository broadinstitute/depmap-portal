import os
from typing import List, Union

from depmap import data_access
from depmap.dataset.models import BiomarkerDataset, DependencyDataset
from depmap.download.utils import get_download_url
from depmap.enums import BiomarkerEnum, DependencyEnum
from depmap.cell_line.models_new import DepmapModel
from flask_restplus import Namespace, Resource
from flask import current_app, request
import pandas as pd

namespace = Namespace("data_page", description="View data availability in the portal")


ALL_DATA_AVAIL_FILE = "all_data_avail.csv"

# Controls the order of data group in the overview data availability graph
DATA_ORDER = [
    "CRISPR_Achilles_Broad",
    "CRISPR_Score_Sanger",
    "CRISPR_ParalogsScreens",
    "RNAi_Marcotte",
    "RNAi_Achilles_Broad",
    "RNAi_Drive_Novartis",
    "Sequencing_WES_Broad",
    "Sequencing_WES_Sanger",
    "Sequencing_WGS_Broad",
    "Sequencing_RNA_Broad",
    "Drug_CTD_Broad",
    "Drug_Repurposing_Broad",
    "Drug_GDSC_Sanger",
    "Drug_OncRef_Broad",
    "Proteomics_Olink",
    "Proteomics_RPPA_CCLE",
    "Proteomics_MS_CCLE",
    "Proteomics_MS_Sanger",
    "Methylation_Sanger",
    "Methylation_CCLE",
    "Uncategorized_miRNA_CCLE",
    "Uncategorized_ATACSeq_Broad",
]


def _get_drug_count_mapping(data_types: List[str]):
    def _get_drug_count(dataset_name: str):
        dataset = DependencyDataset.get_dataset_by_name(dataset_name)

        if not dataset:
            return None

        return len(data_access.get_dataset_feature_labels_by_id(dataset_name))

    drug_counts_by_data_type = {
        "Drug_CTD_Broad": _get_drug_count(DependencyEnum.CTRP_AUC.name),
        "Drug_Repurposing_Broad": _get_drug_count(
            DependencyEnum.Rep_all_single_pt.name
        ),
        "Drug_GDSC_Sanger": _get_drug_count(DependencyEnum.GDSC2_AUC.name),
        "Drug_OncRef_Broad": _get_drug_count(DependencyEnum.Prism_oncology_AUC.name),
    }

    current_env_mapping = {
        data_type_name: drug_count
        for data_type_name, drug_count in drug_counts_by_data_type.items()
        if data_type_name in data_types
    }

    return current_env_mapping


def _get_data_type_url_mapping(data_types: List[str]):
    def _get_dataset_url(dataset_name, isDependencyDataset=True) -> Union[str, None]:
        data_page_endpoint = "data_page.view_data_page"
        dataset = (
            DependencyDataset.get_dataset_by_name(dataset_name)
            if isDependencyDataset
            else BiomarkerDataset.get_dataset_by_name(dataset_name)
        )

        if not dataset:
            return None

        dataset_url = get_download_url(dataset.taiga_id, data_page_endpoint,)
        return dataset_url

    full_mapping = {
        "CRISPR_Achilles_Broad": _get_dataset_url(DependencyEnum.Chronos_Combined.name),
        # CRISPR_Score_Sanger url is set to None by request. _get_dataset_url WILL return
        # a url for crispr sanger, but we do not want this url to show up in the data availability graph.
        "CRISPR_Score_Sanger": None,
        "CRISPR_ParalogsScreens": None,
        "RNAi_Marcotte": None,
        "RNAi_Achilles_Broad": _get_dataset_url(DependencyEnum.RNAi_merged.name),
        "RNAi_Drive_Novartis": _get_dataset_url(DependencyEnum.RNAi_Nov_DEM.name),
        "Sequencing_WES_Broad": None,
        "Sequencing_WES_Sanger": None,
        "Sequencing_WGS_Broad": None,
        "Sequencing_RNA_Broad": None,
        "Drug_CTD_Broad": _get_dataset_url(DependencyEnum.CTRP_AUC.name),
        "Drug_Repurposing_Broad": _get_dataset_url(
            DependencyEnum.Rep_all_single_pt.name
        ),
        "Drug_GDSC_Sanger": _get_dataset_url(DependencyEnum.GDSC2_AUC.name),
        "Drug_OncRef_Broad": _get_dataset_url(DependencyEnum.Prism_oncology_AUC.name),
        "Proteomics_Olink": None,
        "Proteomics_RPPA_CCLE": _get_dataset_url(
            BiomarkerEnum.rppa.name, isDependencyDataset=False
        ),
        "Proteomics_MS_CCLE": _get_dataset_url(
            BiomarkerEnum.proteomics.name, isDependencyDataset=False
        ),
        "Proteomics_MS_Sanger": _get_dataset_url(
            BiomarkerEnum.sanger_proteomics.name, isDependencyDataset=False
        ),
        "Methylation_Sanger": None,
        "Methylation_CCLE": _get_dataset_url(
            BiomarkerEnum.rrbs.name, isDependencyDataset=False
        ),
        "Uncategorized_miRNA_CCLE": None,
        "Uncategorized_ATACSeq_Broad": None,
    }

    current_env_mapping = {
        data_type_name: data_url
        for data_type_name, data_url in full_mapping.items()
        if data_type_name in data_types
    }

    return current_env_mapping


def _get_all_data_avail_df() -> pd.DataFrame:
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, "data_page_summary", ALL_DATA_AVAIL_FILE)
    overall_summary = pd.read_csv(path, index_col="ModelID")
    return overall_summary


def _get_formatted_all_data_avail_df(overall_summary: pd.DataFrame) -> pd.DataFrame:
    available_columns = [
        col for col in DATA_ORDER if col in overall_summary.columns.tolist()
    ]
    ordered_overall_summary = overall_summary[available_columns]
    transposed_summary = ordered_overall_summary.transpose()

    return transposed_summary


def _format_data_availability_summary_dict(summary_df: pd.DataFrame):
    summary_df_index = summary_df.index.tolist()
    data_types_by_url = _get_data_type_url_mapping(summary_df_index)

    drug_count_mapping = _get_drug_count_mapping(summary_df_index)

    summary = {
        "values": summary_df.values.tolist(),
        "data_type_url_mapping": data_types_by_url,
        "drug_count_mapping": drug_count_mapping,
        # For keeping track of data_type order
        "data_types": summary_df_index,
    }

    summary["all_depmap_ids"] = [
        (i, depmap_id) for i, depmap_id in enumerate(summary_df.columns.tolist())
    ]

    return summary


@namespace.route("/data_availability")
class DataAvailability(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Data availability for the current release and across all of the portal
        """
        all_data_df = _get_all_data_avail_df()
        formatted_df = _get_formatted_all_data_avail_df(all_data_df)
        all_data_dict = _format_data_availability_summary_dict(formatted_df)

        return all_data_dict


def _format_lineage_availability_summary_dict(summary_df: pd.DataFrame, data_type: str):
    models_available = (
        summary_df.loc[data_type]
        .explode()[summary_df.loc[data_type].explode() == True]
        .index.tolist()
    )

    lineage_counts = DepmapModel.get_lineage_primary_disease_counts(models_available)

    summary = {
        "lineage_counts": lineage_counts,
    }

    return summary


@namespace.route("/lineage_availability")
class LineageAvailability(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Lineage data availability across all of the portal
        """
        data_type = request.args.get("data_type")

        all_data_df = _get_all_data_avail_df()
        formatted_df = _get_formatted_all_data_avail_df(all_data_df)
        lineage_dict = _format_lineage_availability_summary_dict(
            formatted_df, data_type
        )

        return lineage_dict
