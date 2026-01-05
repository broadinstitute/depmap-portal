from flask import url_for

from depmap.enums import BiomarkerEnum

DATASET_LABEL_TO_ENUM = {
    "MutDam": BiomarkerEnum.mutations_damaging,
    "MutDrv": BiomarkerEnum.mutations_driver,
    "MutHot": BiomarkerEnum.mutations_hotspot,
    "RRBS": BiomarkerEnum.rrbs,
    "RPPA": BiomarkerEnum.rppa,
    "RNAseq": BiomarkerEnum.expression,
    "metabolomics": BiomarkerEnum.metabolomics,
    "rnai-confounders": BiomarkerEnum.rnai_confounders,
    "crispr-confounders": BiomarkerEnum.crispr_confounders,
    "oncref-confounders": BiomarkerEnum.oncref_confounders,
    "oncref_seq-confounders": BiomarkerEnum.oncref_seq_confounders,
    "repallsinglept-confounders": BiomarkerEnum.rep_all_single_pt_confounders,
    "rep1m-confounders": BiomarkerEnum.rep1m_confounders,
    "Fusion": BiomarkerEnum.fusions,
    "ssGSEA": BiomarkerEnum.ssgsea,
    "Lin": BiomarkerEnum.context,
    "CN": BiomarkerEnum.copy_number_relative,
}


def get_predictability_input_files_downloads_link():
    return url_for(
        "download.custom_download",
        default_selected=",".join(
            sorted([v.name for v in DATASET_LABEL_TO_ENUM.values()])
        ),
    )
