import numpy as np
import pandas as pd
from ..utils import assert_status_ok, assert_status_not_ok, upload_and_get_file_ids
from typing import Literal
from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType
from fastapi.testclient import TestClient
from tests import factories
import sqlite3
from glob import glob

import pytest
import packed_cor_tables


def test_associations(
    client: TestClient, minimal_db: SessionWithUser, public_group, settings, tmpdir
):
    def get_assoc_table_file_count():
        return len(glob(f"{settings.filestore_location}/associations/*.sqlite3"))

    def create_dim_type(axis: Literal["feature", "sample"], count: int):
        # Define label metadata for our features
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name=f"some_{axis}_type",
            id_column="label",
            annotation_type_mapping={"label": AnnotationType.text,},
            axis=axis,
            metadata_df=pd.DataFrame({"label": [f"{axis}{i}" for i in range(count)],}),
        )

    create_dim_type("feature", 3)
    create_dim_type("sample", 3)

    def create_matrix_dataset(sample_count, feature_count):
        # Define a matrix dataset
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=[f"feature{i}" for i in range(feature_count)],
            sample_ids=[f"sample{i}" for i in range(sample_count)],
            values=np.array(
                [[1 for i in range(feature_count)] for j in range(sample_count)]
            ),
        )
        dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="some_feature_type",
            sample_type="some_sample_type",
            data_file=example_matrix_values,
        )
        return dataset

    dataset_1_feature_count = 3
    dataset_2_feature_count = 2
    dataset_1 = create_matrix_dataset(3, dataset_1_feature_count)
    dataset_2 = create_matrix_dataset(3, dataset_2_feature_count)
    minimal_db.commit()

    assoc_table_1 = str(tmpdir.join("assoc.sqlite3"))

    packed_cor_tables.write_cor_df(
        pd.DataFrame(
            {
                "dim_0": [0, 0],
                "dim_1": [0, 1],
                "cor": [0.1, 0.2],
                "log10qvalue": [-12.5, -10.1],
            }
        ),
        packed_cor_tables.InputMatrixDesc(
            given_ids=[f"feature{i}" for i in range(dataset_1_feature_count)],
            taiga_id="ds1",
            name="ds1",
        ),
        packed_cor_tables.InputMatrixDesc(
            given_ids=[f"feature{i}" for i in range(dataset_2_feature_count)],
            taiga_id="ds1",
            name="ds1",
        ),
        assoc_table_1,
    )

    # associations in the flipped direction
    # assoc_table_2 = str(tmpdir.join("assoc.sqlite3"))
    #
    # packed_cor_tables.write_cor_df(
    #     pd.DataFrame({"dim_0": [0], "dim_1": [0], "cor": [0.1], "log10qvalue": [-9.1]}),
    #     packed_cor_tables.InputMatrixDesc(given_ids=[f"feature{i}" for i in range(dataset_2_feature_count)],
    #                                       taiga_id="ds1",
    #                                       name="ds1", ),
    #     packed_cor_tables.InputMatrixDesc(given_ids=[f"feature{i}" for i in range(dataset_1_feature_count)],
    #                                       taiga_id="ds1",
    #                                       name="ds1",
    #                                       ),
    #     assoc_table_1,
    # )

    file_ids, expected_md5 = upload_and_get_file_ids(client, filename=assoc_table_1)

    # first upload attempt: should fail because user doesn't have access
    response = client.post(
        "/temp/associations",
        json={
            "dataset_1_id": dataset_1.id,
            "dataset_2_id": dataset_2.id,
            "axis": "feature",
            "file_ids": file_ids,
            "md5": expected_md5,
        },
        headers={"X-Forwarded-User": "anonymous"},
    )
    assert response.status_code == 403

    # second upload attempt: should succeed because we're uploading as admin
    response = client.post(
        "/temp/associations",
        json={
            "dataset_1_id": dataset_1.id,
            "dataset_2_id": dataset_2.id,
            "axis": "feature",
            "file_ids": file_ids,
            "md5": expected_md5,
        },
        headers={"X-Forwarded-User": settings.admin_users[0]},
    )

    assert_status_ok(response)
    response_content = response.json()
    assoc_id = response_content.get("id")

    # make sure the file is in the right place
    assert get_assoc_table_file_count() == 1

    # make sure we can see it
    response = client.get("/temp/associations", headers={"X-Forwarded-User": "anon"},)

    assert_status_ok(response)
    response_content = response.json()
    assert len(response_content) == 1

    # query feature 0 in dataset 1
    response = client.post(
        "/temp/associations/query-slice",
        json={
            "identifier_type": "feature_id",
            "dataset_id": dataset_1.id,
            "identifier": "feature0",
        },
        headers={"X-Forwarded-User": "anon"},
    )

    assert_status_ok(response)
    response_content = response.json()
    assert len(response_content["associated_datasets"]) == 1
    fa1, fa2 = sorted(
        response_content["associated_dimensions"],
        key=lambda x: x["other_dimension_given_id"],
    )

    assert fa1["other_dimension_given_id"] == "feature0"
    assert fa1["other_dimension_label"] == "feature0"
    assert fa1["other_dataset_id"] == dataset_2.id
    assert fa1["correlation"] == pytest.approx(0.1)

    assert fa2["other_dimension_given_id"] == "feature1"
    assert fa2["other_dimension_label"] == "feature1"
    assert fa2["other_dataset_id"] == dataset_2.id
    assert fa2["correlation"] == pytest.approx(0.2)

    # # query feature 0 in dataset 2 (this one only has one correlation stored)
    # response = client.post(
    #     "/temp/associations/query-slice",
    #     json={
    #         "identifier_type": "feature_id",
    #         "dataset_id": dataset_2.id,
    #         "identifier": "feature0",
    #     },
    #     headers={"X-Forwarded-User": "anon"},
    # )
    #
    # assert_status_ok(response)
    # response_content = response.json()
    # assert len(response_content["associated_datasets"]) == 1
    # assert response_content["associated_dimensions"] == [
    #     {
    #         "correlation": 0.1,
    #         "other_dataset_id": dataset_1.id,
    #         "other_dimension_given_id": "feature0",
    #         "other_dimension_label": "feature0",
    #     }
    # ]

    # now, delete it
    response = client.delete(f"/temp/associations/{assoc_id}")

    # just kidding, you're not allowed to
    assert response.status_code == 403

    # now, delete it as an admin
    response = client.delete(
        f"/temp/associations/{assoc_id}",
        headers={"X-Forwarded-User": settings.admin_users[0]},
    )
    assert_status_ok(response)

    # make sure it's gone
    response = client.get("/temp/associations", headers={"X-Forwarded-User": "anon"},)

    assert_status_ok(response)
    response_content = response.json()
    assert len(response_content) == 0

    # make sure the file is gone too
    assert get_assoc_table_file_count() == 0
