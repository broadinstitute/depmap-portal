from tests import factories
import json
from fastapi.testclient import TestClient
import pandas as pd
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata
import pytest
import time
from ..utils import assert_status_ok


@pytest.mark.slow
def test_large_metadata_index(client: TestClient, minimal_db, settings):
    """
    This is really more of a performance test, so marking as slow so that it's not always run. However,
    checking it in in case we find the need again in the near future.

    If things change much I wouldn't worry about maintaining this test though. Anyone can feel free to delete it
    if it gets in the way. It's not run by default.
    """
    db = minimal_db
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    dim_type_fields = {
        "name": "sample_id_name",
        "axis": "sample",
        "id_column": "sample_id",
    }

    # this should be successful
    response = client.post(
        "/types/dimension", json=dim_type_fields, headers=admin_headers,
    )
    assert_status_ok(response)

    # now add a metadata table
    new_metadata = factories.tabular_dataset(
        db,
        settings,
        columns_metadata={
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "sample_id": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name="sample_id_name",
        data_df=pd.DataFrame(
            {
                "sample_id": [f"sample{i}" for i in range(10000)],
                "label": [f"label{i}" for i in range(10000)],
            }
        ),
    )

    start = time.time()
    response = client.patch(
        "/types/dimension/sample_id_name",
        json=(
            {"metadata_dataset_id": new_metadata.id, "properties_to_index": ["label"]}
        ),
        headers=admin_headers,
    )
    assert_status_ok(response)
    end = time.time()

    assert end - start < 10
