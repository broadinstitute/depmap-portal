from depmap.enums import DataTypeEnum


metmap_datasets = {
    "metmap-data-f459.3/metmap125_metastatic_potential": {
        "label": "MetMap 125: Metastatic Potential",
        "units": "Relative Metastatic Potential log10",
        "data_type": DataTypeEnum.metmap,
        "priority": None,
        "feature_name": "MetMap site",
        "transpose": True,
        "prepopulate": True,
        "is_continuous": True,
    },
    "metmap-data-f459.3/metmap500_metastatic_potential": {
        "label": "MetMap 500: Metastatic Potential",
        "units": "Relative Metastatic Potential log10",
        "data_type": DataTypeEnum.metmap,
        "priority": None,
        "feature_name": "MetMap site",
        "transpose": True,
        "prepopulate": True,
        "is_continuous": True,
    },
    "metmap-data-f459.3/metmap500_penetrance": {
        "label": "MetMap 500: Penetrance",
        "units": "Penetrance (0 to 1)",
        "data_type": DataTypeEnum.metmap,
        "priority": None,
        "feature_name": "MetMap site",
        "transpose": True,
        "prepopulate": True,
        "is_continuous": True,
    },
}
