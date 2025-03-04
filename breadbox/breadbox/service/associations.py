import os
from breadbox.db.session import SessionWithUser
from depmap_compute.slice import SliceQuery
from breadbox.schemas.associations import Associations, Association, DatasetSummary
import sqlite3
from breadbox.crud import associations as associations_crud
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
)
from breadbox.service import slice as slice_service
import logging
from breadbox.crud.dimension_types import get_dimension_type_labels_by_id

import packed_cor_tables

log = logging.getLogger(__name__)


def get_associations(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> Associations:
    dataset_id = slice_query.dataset_id

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Could not find dataset {dataset_id}")

    precomputed_assoc_tables = associations_crud.get_association_tables(db, dataset.id)
    datasets = []
    associated_dimensions = []

    resolved_slice = slice_service.resolve_slice_to_components(db, slice_query)

    dim_label_cache = {}

    def _get_dimension_label(dimension_type, given_id):
        if dimension_type not in dim_label_cache:
            dim_label_cache[dimension_type] = get_dimension_type_labels_by_id(
                db, dimension_type
            )
        labels_by_id = dim_label_cache[dimension_type]
        if given_id in labels_by_id:
            return labels_by_id[given_id]
        else:
            return None

    for precomputed_assoc_table in precomputed_assoc_tables:
        assert precomputed_assoc_table.dataset_1_id == dataset.id
        other_dataset = precomputed_assoc_table.dataset_2

        if slice_query.identifier_type in ["feature_id", "feature_label", "column"]:
            other_dimension_type = other_dataset.feature_type_name
        else:
            assert slice_query.identifier_type in ["sample_id", "sample_label"]
            other_dimension_type = other_dataset.sample_type_name

        datasets.append(
            DatasetSummary(
                id=precomputed_assoc_table.id,
                name=other_dataset.name,
                dimension_type=other_dimension_type,
                dataset_id=other_dataset.id,
            )
        )

        precomputed_assoc_table_path = os.path.join(
            filestore_location, precomputed_assoc_table.filename
        )

        correlation_df = packed_cor_tables.read_cor_for_given_id(
            precomputed_assoc_table_path, resolved_slice.given_id
        )

        for row in correlation_df.to_records():
            other_dimension_given_id = row["feature_given_id_1"]
            associated_label = _get_dimension_label(
                other_dimension_type, other_dimension_given_id
            )
            if associated_label is None:
                log.warning(
                    f"Could not find {other_dimension_type} with id {other_dimension_given_id}"
                )
                continue

            associated_dimensions.append(
                Association(
                    correlation=row["cor"],
                    log10qvalue=row["log10qvalue"],
                    other_dataset_id=other_dataset.id,
                    other_dimension_given_id=other_dimension_given_id,
                    other_dimension_label=associated_label,
                )
            )

    return Associations(
        dataset_name=dataset.name,
        dimension_label=resolved_slice.label,
        associated_datasets=datasets,
        associated_dimensions=associated_dimensions,
    )
