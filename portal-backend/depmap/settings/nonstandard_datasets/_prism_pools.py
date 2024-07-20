from depmap.enums import DataTypeEnum
from depmap.interactive.config import categories

prism_pool_datasets = {
    "prism-pools-4441.2/coded_prism_pools": {
        "label": "Current PRISM Pools",
        "units": "",
        "data_type": DataTypeEnum.deprecated,
        "priority": None,
        "feature_name": "Cell line group",
        "transpose": True,
        "prepopulate": True,
        "use_arxspan_id": True,
        "is_categorical": True,
        "categories": categories.PrismPoolConfig(),
    }
}
