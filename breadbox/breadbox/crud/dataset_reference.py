from typing import Dict

from breadbox.db.session import SessionWithUser
from ..models.dataset import (
    DatasetReference,
    DimensionType,
    TabularDataset,
)


# Users have the ability to specify the columns they want to add to the DimensionSearchIndex when they add
# a DimensionType. The columns to add are in dataset.properties_to_index. Sometimes these columns refer to "foreign key"
# relationships. For example, the compound DimensionType might have a column "target" that points to a different DimensionType "gene".
# This would be defined in the id_mapping as "reference_column_mappings": {"target": "gene"}.
def add_id_mapping(
    db: SessionWithUser,
    reference_column_mappings: Dict[str, str],
    dataset: TabularDataset,
):
    dataset_reference_rows = []
    for column, reference_table_feature_type_name in reference_column_mappings.items():
        assert isinstance(column, str)
        assert isinstance(reference_table_feature_type_name, str)

        dimension_type = (
            db.query(DimensionType)
            .filter(DimensionType.name == reference_table_feature_type_name)
            .one_or_none()
        )

        if dimension_type is None:
            raise ValueError(
                f'Column "{column}" was annotated as referencing "{reference_table_feature_type_name}" but no such type could be found'
            )

        if dimension_type.dataset is None:
            raise ValueError(
                f'Column "{column}" was annotated as referencing "{reference_table_feature_type_name}" but type does not have any metadata in database'
            )

        referenced_dataset = dimension_type.dataset

        dataset_reference_rows.append(
            DatasetReference(
                dataset_id=dataset.id,
                column=column,
                group_id=dataset.group_id,
                referenced_dataset_id=referenced_dataset.id,
                referenced_group_id=referenced_dataset.group_id,
            )
        )

    if len(dataset_reference_rows) > 0:
        db.bulk_save_objects(dataset_reference_rows)
        db.flush()
