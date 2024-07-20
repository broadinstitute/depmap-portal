from depmap.enums import DataTypeEnum


ccle_arm_level_cna_dataset_id = "ccle-arm-level-cnas-5cc7.7"

ccle_arm_level_cna_datasets = {
    ccle_arm_level_cna_dataset_id
    + "/CCLE_arm_call_matrix": {
        "label": "Arm-level CNAs",
        "units": "",
        "data_type": DataTypeEnum.cn,
        "priority": None,
        "feature_name": "Chromosome Arm",
        "transpose": True,
        "prepopulate": True,
        "is_continuous": True,
        "use_arxspan_id": True,
    },
    ccle_arm_level_cna_dataset_id
    + "/aneuploidy_data_for_taiga": {
        "label": "Aneuploidy",
        "units": "Arm Events",
        "data_type": DataTypeEnum.cn,
        "priority": None,
        "feature_name": "feature",
        "transpose": True,
        "prepopulate": True,
        "is_continuous": True,
        "use_arxspan_id": True,
    },
}
