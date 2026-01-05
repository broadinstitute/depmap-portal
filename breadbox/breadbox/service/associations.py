import os
import numpy as np
from typing import List, Optional
from breadbox.crud.dimension_ids import get_dimension_type_label_mapping_df

from breadbox.depmap_compute_embed.slice import SliceQuery
from breadbox.db.session import SessionWithUser
from breadbox.schemas.associations import (
    Associations,
    Association,
    DatasetSummary,
)
from breadbox.crud import associations as associations_crud
from breadbox.crud import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
)
from breadbox.service import slice as slice_service
import logging
from breadbox.crud.dimension_ids import get_dimension_type_labels_by_id

import packed_cor_tables

log = logging.getLogger(__name__)
from breadbox.utils.profiling import profiled_region


def get_associations(
    db: SessionWithUser,
    filestore_location: str,
    slice_query: SliceQuery,
    association_datasets: Optional[List[str]] = None,
) -> Associations:
    dataset_id = slice_query.dataset_id

    with profiled_region("in get_associations: get dataset"):
        dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
        if dataset is None:
            raise ResourceNotFoundError(f"Could not find dataset {dataset_id}")

    with profiled_region("in get_associations: get_association_tables"):
        precomputed_assoc_tables = associations_crud.get_association_tables(
            db, dataset.id, association_datasets
        )
    datasets = []
    associated_dimensions = []

    with profiled_region("in get_associations: resolve_slice_to_components"):
        resolved_slice = slice_service.resolve_slice_to_components(db, slice_query,)

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
                dataset_given_id=other_dataset.given_id,
            )
        )

        precomputed_assoc_table_path = os.path.join(
            filestore_location, precomputed_assoc_table.filename
        )

        with profiled_region("in get_associations: read_cor_for_given_id"):
            correlation_df = packed_cor_tables.read_cor_for_given_id(
                precomputed_assoc_table_path, resolved_slice.given_id
            )

        # look up all labels with a single query to produce a map that we'll use a little later.
        label_id_mapping_df = get_dimension_type_label_mapping_df(
            db,
            other_dimension_type,
            given_ids=correlation_df["feature_given_id_1"].tolist(),
        )
        label_by_given_id = {
            row["given_id"]: row["label"]
            for row in label_id_mapping_df.reset_index(drop=True).to_records()
        }

        with profiled_region("in get_associations: create Association records"):
            for row in correlation_df.to_records():
                other_dimension_given_id = row["feature_given_id_1"]
                associated_label = label_by_given_id.get(other_dimension_given_id)
                if associated_label is None:
                    log.warning(
                        f"Could not find {other_dimension_type} with id {other_dimension_given_id}"
                    )
                    continue

                log10qvalue = row["log10qvalue"]

                # if correlation is 1 then the qvalue can be 0 which results in log10 qvalue to be -inf
                # if we see this, bound it at -1e100 to avoid json serialization error
                if np.isinf(log10qvalue):
                    log10qvalue = -1e100

                associated_dimensions.append(
                    Association(
                        correlation=row["cor"],
                        log10qvalue=log10qvalue,
                        other_dataset_id=other_dataset.id,
                        other_dataset_given_id=other_dataset.given_id,
                        other_dimension_given_id=other_dimension_given_id,
                        other_dimension_label=associated_label,
                    )
                )

    return Associations(
        dataset_name=dataset.name,
        dataset_given_id=dataset.given_id,
        dimension_label=resolved_slice.label,
        associated_datasets=datasets,
        associated_dimensions=associated_dimensions,
    )
