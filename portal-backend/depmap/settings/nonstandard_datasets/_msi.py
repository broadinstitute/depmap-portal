from depmap.enums import DataTypeEnum
from depmap.interactive.config import categories

msi_datasets = {
    "msi-0584.6/msi": {
        "label": "Microsatellite Instability",
        "units": "MSI status",
        "data_type": DataTypeEnum.msi,
        "priority": None,
        "feature_name": "MSI annotation source",
        "transpose": True,
        "prepopulate": True,
        "use_arxspan_id": True,
        "is_categorical": True,
        "categories": categories.MsiConfig(),
    }
}

# data type deprecated:
