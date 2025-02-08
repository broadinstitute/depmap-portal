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
from breadbox.service import metadata as metadata_service
from typing import Tuple

from breadbox.crud.dimension_types import get_dimension_type_labels_by_id
import zlib
import numpy as np
import pandas as pd

ROW_BYTE_SIZE = 4 + 4 + 4  # 32 bit int, 32 bit float, 32 bit float


def _get_top_correlates(filename, given_id):
    conn = sqlite3.connect(filename)

    # fetch the blob for the given feature
    cursor = conn.cursor()
    cursor.execute(
        "select c.dim_0, c.cbuf from correlation c join dim_0_given_id f on f.dim_0=c.dim_0 where f.given_id = ?",
        [given_id],
    )
    row = cursor.fetchone()
    if row is None:
        return pd.DataFrame(
            {
                "dim_0": [],
                "dim_1": [],
                "cor": [],
                "log10qvalue": [],
                "feature_given_id_0": [],
                "dataset_given_id_0": [],
                "feature_given_id_1": [],
                "dataset_given_id_1": [],
            }
        )
    index, cbuf = row
    # now unpack the value
    buf = zlib.decompress(cbuf)
    row_count = len(buf) // ROW_BYTE_SIZE
    start = 0
    end = 4 * row_count
    dim_1 = np.frombuffer(buf[start:end], dtype="int32")
    start = end
    end += 4 * row_count
    cor = np.frombuffer(buf[start:end], dtype="float32")
    start = end
    end += 4 * row_count
    log10qvalue = np.frombuffer(buf[start:end], dtype="float32")

    df = pd.DataFrame(
        {"dim_0": index, "dim_1": dim_1, "cor": cor, "log10qvalue": log10qvalue}
    )

    def map_dim_index_to_given_ids(dim_i, positions):
        indices = list(set(positions))
        param_str = ",".join(["?"] * len(indices))
        cursor.execute(
            f"select given_id, dim_{dim_i} from dim_{dim_i}_given_id where dim_{dim_i} in ({param_str})",
            indices,
        )
        position_to_label = {i: given_id for given_id, i in cursor.fetchall()}
        return [position_to_label[position] for position in positions]

    cursor.execute("select dim_index, dataset_given_id from dataset")
    given_id_by_dataset_index = {
        dim_index: given_id for dim_index, given_id in cursor.fetchall()
    }

    df["feature_given_id_0"] = map_dim_index_to_given_ids(0, df["dim_0"])
    df["feature_given_id_1"] = map_dim_index_to_given_ids(1, df["dim_1"])
    df["dataset_given_id_0"] = given_id_by_dataset_index[0]
    df["dataset_given_id_1"] = given_id_by_dataset_index[1]

    cursor.close()
    conn.close()

    return df.drop(columns=["dim_0", "dim_1"])


def get_associations(
    db: SessionWithUser, filestore_location: str, slice_query: SliceQuery
) -> Associations:
    dataset_id = slice_query.dataset_id

    dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
    if dataset is None:
        raise ResourceNotFoundError(f"Could not find dataset {dataset_id}")

    precomputed_assoc_tables = associations_crud.get_association_tables(db, dataset_id)
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
            raise AssertionError(
                f"Could not find {given_id} in dimension_type {dimension_type}"
            )

    for precomputed_assoc_table in precomputed_assoc_tables:
        assert precomputed_assoc_table.dataset_1_id == dataset_id
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

        correlation_df = _get_top_correlates(
            precomputed_assoc_table_path, resolved_slice.given_id
        )

        for row in correlation_df.to_records():
            associated_label = _get_dimension_label(
                other_dimension_type, row["feature_given_id_1"]
            )
            associated_dimensions.append(
                Association(
                    correlation=row["cor"],
                    log10qvalue=row["log10qvalue"],
                    other_dataset_id=other_dataset.id,
                    other_dimension_given_id=row["feature_given_id_1"],
                    other_dimension_label=associated_label,
                )
            )

    return Associations(
        dataset_name=dataset.name,
        dimension_label=resolved_slice.label,
        associated_datasets=datasets,
        associated_dimensions=associated_dimensions,
    )
