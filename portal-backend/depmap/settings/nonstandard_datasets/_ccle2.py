from depmap.enums import DataTypeEnum


ccle2_paper_nonstandard_datasets = {
    "global-chromatin-profiling-34f3.1/CCLE_GlobalChromatinProfiling_20181130": {
        "label": "Global Chromatin Profiling",
        "units": "Histone Mark Abundance",
        "data_type": DataTypeEnum.global_epigenomic_feature,
        "priority": None,
        "feature_name": "histone mark",
        "transpose": True,
        "prepopulate": True,
        "use_arxspan_id": True,
        "is_continuous": True,
    },
    "mirna-573f.3/CCLE_miRNA_MIMAT": {
        "label": "miRNA Expression",
        "units": "Count (log2)",
        "data_type": DataTypeEnum.expression,
        "priority": None,
        "feature_name": "MIMAT ID",
        "feature_example": "MIMAT0000094",
        "transpose": True,
        "use_arxspan_id": True,
        "is_continuous": True,
    },
}
