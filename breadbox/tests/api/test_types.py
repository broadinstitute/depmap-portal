from breadbox.crud.dimension_types import get_dimension_type
from breadbox.schemas.types import IdMapping
from fastapi.testclient import TestClient
from sqlalchemy import and_, text
from breadbox.models.dataset import DimensionType, Dataset, TabularDataset
from breadbox.models.dataset import (
    Dimension,
    TabularColumn,
    TabularCell,
)
from tests import factories
import json
import os
from pathlib import Path
import numpy as np
from tests.factories import feature_type_with_metadata
from io import BytesIO
from breadbox.models.dataset import DimensionSearchIndex
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata
import pandas as pd
from ..utils import assert_status_ok, assert_status_not_ok
from breadbox.service.search import _get_datatypes_referencing
from breadbox.service.reachable import MAX_HOPS, build_reachable
from breadbox.service.reference_graph import LoadedColumn, LoadedTable


def test_all_dimension_type_methods(client: TestClient, minimal_db, settings):
    db = minimal_db
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    dim_type_fields = {
        "name": "sample_id_name",
        "display_name": "Sample Name",
        "axis": "sample",
        "id_column": "sample_id",
    }

    # check admin access is required
    response = client.post(
        "/types/dimensions",
        json=dim_type_fields,
        headers={"X-Forwarded-Email": "not-admin"},
    )
    assert_status_not_ok(response)

    # this should be successful
    response = client.post(
        "/types/dimensions", json=dim_type_fields, headers=admin_headers,
    )
    assert_status_ok(response)
    dim_type_fields_d = json.loads(json.dumps(dim_type_fields))
    dim_type_fields_d["properties_to_index"] = []
    dim_type_fields_d["metadata_dataset_id"] = None
    assert response.json() == dim_type_fields_d

    # now add a metadata table
    # now, update the metadata
    new_metadata = factories.tabular_dataset(
        db,
        settings,
        columns_metadata={
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "sample_id": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name="sample_id_name",
        data_df=pd.DataFrame({"sample_id": ["Y"], "label": ["X"]}),
    )

    # Make sure if only properties_to_index is provided, throw and error. It should only be provided when there is dimension type metadata
    response = client.patch(
        "/types/dimensions/sample_id_name",
        json=({"metadata_dataset_id": new_metadata.id}),
        headers=admin_headers,
    )
    assert_status_ok(response)
    response = client.patch(
        "/types/dimensions/sample_id_name",
        json=({"properties_to_index": ["label"]}),
        headers=admin_headers,
    )
    assert_status_not_ok(response)

    response = client.patch(
        "/types/dimensions/sample_id_name",
        json=(
            {"metadata_dataset_id": new_metadata.id, "properties_to_index": ["label"]}
        ),
        headers=admin_headers,
    )
    assert_status_ok(response)

    # read it back and verify the metadata changed
    response = client.get("/types/dimensions/sample_id_name")
    assert_status_ok(response)
    dim_type = response.json()
    assert dim_type["properties_to_index"] == ["label"]
    assert dim_type["metadata_dataset_id"] == new_metadata.id
    assert dim_type["display_name"] == dim_type_fields["display_name"]

    # verify we can see it in the list of all types
    def sample_id_name_exists():
        response_ = client.get("/types/dimensions")
        assert_status_ok(response_)
        return "sample_id_name" in [x["name"] for x in response_.json()]

    assert sample_id_name_exists()

    # Verify only the dimension type display name has changed
    response = client.patch(
        "/types/dimensions/sample_id_name",
        json=({"display_name": "New Sample Name"}),
        headers=admin_headers,
    )
    assert_status_ok(response)
    dim_type = response.json()
    assert dim_type["display_name"] == "New Sample Name"
    # The previously updated fields are still changed
    assert dim_type["metadata_dataset_id"] == new_metadata.id
    assert dim_type["properties_to_index"] == ["label"]

    # verify deleting requires admin
    response = client.delete(
        "/types/dimensions/sample_id_name", headers={"X-Forwarded-Email": "not-admin"}
    )
    assert_status_not_ok(response)
    minimal_db.reset_user(settings.admin_users[0])

    # Make sure deleting cannot be done if nonmetadata dataset using dimension type
    matrix_dataset = factories.matrix_dataset(
        db, settings, sample_type=dim_type_fields["name"]
    )
    response = client.delete("/types/dimensions/sample_id_name", headers=admin_headers,)
    assert response.status_code == 409

    # make sure we can delete it
    # first delete dataset using dimension type we want to delete
    res_del_dataset = client.delete(
        f"/datasets/{matrix_dataset.id}", headers=admin_headers,
    )
    assert_status_ok(res_del_dataset)
    # check metadata dataset exist first
    metadata_dataset = (
        minimal_db.query(Dataset).filter_by(id=new_metadata.id).one_or_none()
    )
    assert metadata_dataset.id == new_metadata.id
    response = client.delete("/types/dimensions/sample_id_name", headers=admin_headers,)
    assert_status_ok(response)
    # verify metadata dataset deleted along with its dimension type
    metadata_dataset = (
        minimal_db.query(Dataset).filter_by(id=new_metadata.id).one_or_none()
    )
    assert metadata_dataset is None

    # and now reports as missing
    response = client.get("/types/dimensions/sample_id_name")
    assert response.status_code == 404

    assert not sample_id_name_exists()


def test_get_impacted_dataset_ids(client: TestClient, minimal_db, settings):
    db = minimal_db

    parent_metadata = pd.DataFrame(
        {"parent_id": ["1", "2"], "label": ["parent_a", "parent_b"]}
    )

    child1_metadata = pd.DataFrame(
        {
            "child_id1": ["3", "4"],
            "parent": ["2", "2"],
            "label": ["child1_c", "child1_d"],
        }
    )
    grandchild1_metadata = pd.DataFrame(
        {
            "grandchild_id1": ["3", "4"],
            "child1": ["3", "4"],
            "label": ["grandchild1_c", "grandchild1_d"],
        }
    )

    child2_metadata = pd.DataFrame(
        {
            "child_id2": ["3", "4"],
            "parent": ["1", "1"],
            "label": ["child2_c", "child2_d"],
        }
    )

    parent2_metadata = pd.DataFrame({"parent2_id": ["3", "4"], "label": ["a", "b"],})

    child_of_parent2_metadata = pd.DataFrame(
        {
            "child_of_parent2_id": ["3", "4"],
            "parent2": ["2", "2"],
            "label": ["child_of_parent2_c", "child_of_parent2_d"],
        }
    )

    # add two feature types
    parent = factories.feature_type_with_metadata(
        db,
        settings,
        name="parent",
        id_column="parent_id",
        metadata_df=parent_metadata,
        properties_to_index=["label"],
    )

    parent_dim_type = get_dimension_type(db, "parent")
    assert parent_dim_type is not None
    parent_impacted_datasets = _get_datatypes_referencing(db, parent_dim_type.name)

    assert parent_impacted_datasets == {"parent"}

    child1 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child1",
        id_column="child_id1",
        metadata_df=child1_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent": "parent"}),
    )

    child1_impacted_datasets = _get_datatypes_referencing(db, "child1")
    assert child1_impacted_datasets == {"child1"}

    parent_impacted_datasets = _get_datatypes_referencing(db, "parent")
    assert parent_impacted_datasets == {"child1", "parent"}

    grandchild1 = factories.feature_type_with_metadata(
        db,
        settings,
        name="grandchild1",
        id_column="grandchild_id1",
        metadata_df=grandchild1_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"child1": "child1"}),
    )

    parent_impacted_datasets = _get_datatypes_referencing(db, "parent")
    assert parent_impacted_datasets == {"grandchild1", "child1", "parent"}

    child2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child2",
        id_column="child_id2",
        metadata_df=child2_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent": "parent"}),
    )

    child2_impacted_datasets = _get_datatypes_referencing(db, "child2")
    assert child2_impacted_datasets == {"child2"}

    parent_impacted_datasets = _get_datatypes_referencing(db, "parent")
    assert parent_impacted_datasets == {"grandchild1", "child1", "child2", "parent"}

    parent2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="parent2",
        id_column="parent2_id",
        metadata_df=parent2_metadata,
        properties_to_index=["label"],
    )

    parent_2_impacted_datasets = _get_datatypes_referencing(db, "parent2")

    assert parent_2_impacted_datasets == {"parent2"}

    child_of_parent_2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child_of_parent2",
        id_column="child_of_parent2_id",
        metadata_df=child_of_parent2_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent2": "parent2"}),
    )

    child_of_parent_2_impacted_datasets = _get_datatypes_referencing(db, "parent2")

    assert child_of_parent_2_impacted_datasets == {"parent2", "child_of_parent2"}


def test_add_sample_types(client: TestClient, settings, minimal_db):
    # make sure we start with nothing
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    response = client.get("/types/sample")
    assert_status_ok(response)
    original_type_count = len(response.json())

    # now add a sample type

    response = client.post(
        "/types/sample",
        data={"name": "internal_sample", "id_column": "internal_sample_id",},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.content
    expected_type = {
        "name": "internal_sample",
        "id_column": "internal_sample_id",
    }

    assert (
        "name" in response.json() and expected_type["name"] == response.json()["name"]
    )
    assert (
        "id_column" in response.json()
        and expected_type["id_column"] == response.json()["id_column"]
    )
    assert "dataset" not in response.json()

    # make sure we can retrieve it
    response = client.get("/types/sample")
    assert_status_ok(response)
    assert len(response.json()) == original_type_count + 1
    # Check if expected dict is subset of the response dict
    by_name = {x["name"]: x for x in response.json()}
    new_type = by_name["internal_sample"]
    assert all(new_type.get(key, None) == val for key, val in expected_type.items())
    assert new_type == expected_type

    # and dimension endpoint can read it
    response = client.get("/types/dimensions/internal_sample")
    assert_status_ok(response)


def test_get_dimension_type_dimension_identifiers(
    client: TestClient, minimal_db, settings
):
    db = minimal_db
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    dim_type_fields = {
        "name": "sample_id_name",
        "display_name": "Sample Name",
        "axis": "sample",
        "id_column": "sample_id",
    }

    # Create dimension type
    dim_type_res = client.post(
        "/types/dimensions", json=dim_type_fields, headers=admin_headers,
    )
    assert_status_ok(dim_type_res)
    expected_dim_type_res = {
        "name": "sample_id_name",
        "display_name": "Sample Name",
        "axis": "sample",
        "id_column": "sample_id",
        "properties_to_index": [],
        "metadata_dataset_id": None,
    }
    assert dim_type_res.json() == expected_dim_type_res

    # Confirm dimension type has no dimension identifiers
    dim_type_ids_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers",
        headers=admin_headers,
    )
    assert_status_ok(dim_type_ids_res)
    assert dim_type_ids_res.json() == []

    # add a metadata table
    # Create data type for metadata
    factories.data_type(db, "metadata")
    dim_type_metadata = factories.tabular_dataset(
        db,
        settings,
        columns_metadata={
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "sample_id": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name=dim_type_fields["name"],
        data_type_="metadata",
        data_df=pd.DataFrame(
            {"sample_id": ["sample-1", "sample-2"], "label": ["Sample 1", "Sample 2"]}
        ),
    )

    dim_type_metadata_res = client.patch(
        f"/types/dimensions/{dim_type_fields['name']}",
        json=(
            {
                "metadata_dataset_id": dim_type_metadata.id,
                "properties_to_index": ["label"],
            }
        ),
        headers=admin_headers,
    )
    assert_status_ok(dim_type_metadata_res)
    expected_dim_type_res["metadata_dataset_id"] = dim_type_metadata.id
    expected_dim_type_res["properties_to_index"] = ["label"]
    assert dim_type_metadata_res.json() == expected_dim_type_res

    # Confirm dimension type has new dimension identifiers
    dim_type_ids_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers",
        headers=admin_headers,
    )
    assert_status_ok(dim_type_ids_res)
    assert dim_type_ids_res.json() == [
        {"id": "sample-1", "label": "Sample 1"},
        {"id": "sample-2", "label": "Sample 2"},
    ]

    # Test that the limit parameter works
    dim_type_ids_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?limit=1",
        headers=admin_headers,
    )
    assert_status_ok(dim_type_ids_res)
    assert dim_type_ids_res.json() == [
        {"id": "sample-1", "label": "Sample 1"},
    ]

    # test dim type doesn't exist
    nonexistent_dim_type_res = client.get(
        f"types/dimensions/nonexistentDimensionType/identifiers", headers=admin_headers,
    )
    assert_status_not_ok(nonexistent_dim_type_res)
    assert nonexistent_dim_type_res.status_code == 404

    # Test show_only_dimensions_in_datasets: Only identifiers in dataset and in metadata returned and identifiers only in metadata not returned
    # If there is no dataset that uses the dimension type's identifiers return empty list
    only_dims_in_dataset_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?show_only_dimensions_in_datasets=True",
        headers=admin_headers,
    )
    assert only_dims_in_dataset_res.json() == []
    # Create a matrix dataset that uses SOME of the dimension type identifiers and has an identifier not in metadata
    # Create data type
    factories.data_type(db, "dataType1")
    matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["feature-1", "feature-2", "feature-3"],
        sample_ids=["sample-1", "sample-3"],
        values=np.array([[1, 2, 3], [4, 5, 6]]),
    )
    matrix_dataset = factories.matrix_dataset(
        db,
        settings,
        sample_type=dim_type_fields["name"],
        data_file=matrix_values,
        data_type="dataType1",
    )
    # Verify only dimension type identifiers defined in metadata are returned and dimension type identfiers not in matrix dataset is also omitted
    only_dims_in_dataset_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?show_only_dimensions_in_datasets=True",
        headers=admin_headers,
    )
    assert_status_ok(only_dims_in_dataset_res)
    only_dims_in_dataset = only_dims_in_dataset_res.json()
    assert len(only_dims_in_dataset) == 1
    assert only_dims_in_dataset[0]["id"] == "sample-1"

    # verify all identifiers for a specific data type are returned. Additionally, only identifiers that are defined in metadata are returned since dimension type identifiers in its metadata would not share the same data type
    all_dims_for_data_type_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?data_type=dataType1",
        headers=admin_headers,
    )
    assert_status_ok(all_dims_for_data_type_res)
    all_dims_for_data_type = all_dims_for_data_type_res.json()
    assert len(all_dims_for_data_type) == 1
    assert all_dims_for_data_type[0]["id"] == "sample-1"

    # Test case if data type is metadata and show only dimensions in datasets is True. We expect that it returns an empty list since only the metadata dataset uses any identifiers
    res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?data_type=metadata&show_only_dimensions_in_datasets=True",
        headers=admin_headers,
    )
    assert res.json() == []

    # Test case if data type is metadata and show only dimensions in datasets is True when
    # there is a dataset of data type metadata with requested dimension type but is not used
    # as a dimension types's metadata.
    # The result should still filter out identifiers that are not found in the dimension type's metadata.
    matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["feature-1", "feature-2", "feature-3"],
        sample_ids=["sample-1", "sample-3"],
        values=np.array([[1, 2, 3], [4, 5, 6]]),
    )
    matrix_dataset_metadata = factories.matrix_dataset(
        db,
        settings,
        sample_type=dim_type_fields["name"],
        data_file=matrix_values,
        data_type="metadata",
    )
    res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?data_type=metadata&show_only_dimensions_in_datasets=True",
        headers=admin_headers,
    )
    assert res.json() == [
        {"id": "sample-1", "label": "Sample 1"},
    ]

    # Test case if data type is metadata and show only dimensions in datasets is False when
    # there is a dataset of data type metadata with requested dimension type but is not used
    # as a dimension types's metadata.
    # This should return dimension identifiers from both datasets but should still filter out
    # identifiers that are not found in the dimension type's metadata.
    res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers?data_type=metadata",
        headers=admin_headers,
    )
    assert res.json() == [
        {"id": "sample-1", "label": "Sample 1"},
        {"id": "sample-2", "label": "Sample 2"},
    ]


def test_invalid_dimension_type_metadata(client: TestClient, minimal_db, settings):
    db = minimal_db
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    dim_type_fields = {
        "name": "sample_id_name",
        "display_name": "Sample Name",
        "axis": "sample",
        "id_column": "sample_id",
    }

    # Create dimension type
    dim_type_res = client.post(
        "/types/dimensions", json=dim_type_fields, headers=admin_headers,
    )
    assert_status_ok(dim_type_res)
    expected_dim_type_res = {
        "name": "sample_id_name",
        "display_name": "Sample Name",
        "axis": "sample",
        "id_column": "sample_id",
        "properties_to_index": [],
        "metadata_dataset_id": None,
    }
    assert dim_type_res.json() == expected_dim_type_res

    # Confirm dimension type has no dimension identifiers
    dim_type_ids_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers",
        headers=admin_headers,
    )
    assert_status_ok(dim_type_ids_res)
    assert dim_type_ids_res.json() == []

    # add a metadata table
    # Create data type for metadata with non-public group
    factories.data_type(db, "metadata")
    group = factories.group(db, settings, "New Group")
    dim_type_metadata = factories.tabular_dataset(
        db,
        settings,
        group_id=group.id,
        columns_metadata={
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "sample_id": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name=dim_type_fields["name"],
        data_type_="metadata",
        data_df=pd.DataFrame(
            {"sample_id": ["sample-1", "sample-2"], "label": ["Sample 1", "Sample 2"]}
        ),
    )

    dim_type_metadata_res = client.patch(
        f"/types/dimensions/{dim_type_fields['name']}",
        json=(
            {
                "metadata_dataset_id": dim_type_metadata.id,
                "properties_to_index": ["label"],
            }
        ),
        headers=admin_headers,
    )
    assert_status_not_ok(dim_type_metadata_res)
    dim_type_metadata_res.status_code = 404


#### /types/sample and types/feature endpoints are deprecated!! ###


def test_add_sample_type_with_taiga_id_no_dataset(client: TestClient, settings):
    # make sure we start with nothing
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

    # add a sample type with taiga id but no dataset should result in error
    response = client.post(
        "/types/sample",
        data={
            "name": "test_sample",
            "id_column": "test_sample_id",
            "taiga_id": "test-taiga.1",
        },
        headers=admin_headers,
    )
    assert response.status_code == 400


def test_add_sample_type_with_metadata(
    client: TestClient, minimal_db, public_group, settings
):
    orig_cell_count = minimal_db.query(TabularCell).count()

    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    # Missing annotation type should throw error
    response_with_no_annotation_mapping = client.post(
        "/types/sample",
        data={"name": "sample", "id_column": "sample_id"},
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(response_with_no_annotation_mapping)
    assert response_with_no_annotation_mapping.status_code == 400

    # Annotation mapping missing column in metadata
    response_with_missing_annotation_mapping = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {"annotation_type_mapping": {"label": "text"}}
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(response_with_missing_annotation_mapping)
    assert response_with_missing_annotation_mapping.status_code == 400

    response_with_metadata = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    expected_type = {"name": "sample", "id_column": "sample_id"}
    assert response_with_metadata.status_code == 200, response_with_metadata.content
    assert response_with_metadata.json()["name"] == expected_type["name"]
    assert response_with_metadata.json()["id_column"] == expected_type["id_column"]
    metadata_dataset_id = response_with_metadata.json()["dataset"]["id"]
    assert (
        response_with_metadata.json()["dataset"]["id"] is not None
        and len(metadata_dataset_id) == 36
    )
    # Both the Dimension and TabularColumn tables should a record for each annotation
    assert (
        len(minimal_db.query(Dimension).filter_by(dataset_id=metadata_dataset_id).all())
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=metadata_dataset_id)
            .all()
        )
        == 3
    )
    assert minimal_db.query(TabularCell).count() == 6 + orig_cell_count


def test_update_ref_col_map(client: TestClient, settings, minimal_db):
    db = minimal_db
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}

    parent_metadata = pd.DataFrame(
        {"parent_id": ["1", "2"], "label": ["parent_a", "parent_b"]}
    )
    child_metadata = pd.DataFrame(
        {"child_id": ["3", "4"], "parent": ["2", "2"], "label": ["child_c", "child_d"]}
    )

    # add two feature types
    feature_type_with_metadata(
        db,
        settings,
        name="parent",
        id_column="parent_id",
        metadata_df=parent_metadata,
        properties_to_index=["label"],
    )
    feature_type_with_metadata(
        db,
        settings,
        name="child",
        id_column="child_id",
        metadata_df=child_metadata,
        properties_to_index=["label"],
    )

    # now update that feature type with an id mapping
    response = client.patch(
        "/types/feature/child/metadata",
        data={
            "properties_to_index": ["label", "parent"],
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "child_id": "text",
                        "parent": "text",
                        "label": "text",
                    }
                }
            ),
            "id_mapping": json.dumps(
                {"id_mapping": {"reference_column_mappings": {"parent": "parent"}}}
            ),
        },
        files={
            "metadata_file": (
                "feature_metadata",
                BytesIO(child_metadata.to_csv(index=False).encode("utf8")),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.content

    # make sure that we have 2 records: 1 for the label of the child and one for the label of the parent
    records = (
        minimal_db.query(DimensionSearchIndex)
        .filter(DimensionSearchIndex.dimension_type_name == "child")
        .filter(DimensionSearchIndex.dimension_given_id == "3")
        .all()
    )
    assert len(records) == 2


def test_add_feature_types(client: TestClient, settings):
    # make sure we start with nothing
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    response = client.get("/types/feature")
    assert_status_ok(response)
    assert response.json() == []

    # now add a feature type

    response = client.post(
        "/types/feature",
        data={"name": "gene", "id_column": "ensembl_id"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.content
    expected_type = {"name": "gene", "id_column": "ensembl_id"}

    assert (
        "name" in response.json() and expected_type["name"] == response.json()["name"]
    )
    assert (
        "id_column" in response.json()
        and expected_type["id_column"] == response.json()["id_column"]
    )
    assert "dataset" not in response.json()

    # make sure we can retrieve it
    response = client.get("/types/feature")
    assert_status_ok(response)
    assert len(response.json()) == 1
    # Check if expected dict is subset of the response dict
    assert all(
        response.json()[0].get(key, None) == val for key, val in expected_type.items()
    )
    assert response.json() == [expected_type]


def test_add_feature_type_with_metadata(
    client: TestClient, minimal_db, public_group, settings
):
    orig_cell_count = minimal_db.query(TabularCell).count()

    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    response_with_metadata = client.post(
        "/types/feature",
        data={
            "name": "gene",
            "id_column": "entrez_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "entrez_id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "entrez_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    expected_type = {"name": "gene", "id_column": "entrez_id"}
    assert response_with_metadata.status_code == 200, response_with_metadata.content
    feature_type_with_metadata = response_with_metadata.json()
    assert feature_type_with_metadata["name"] == expected_type["name"], (
        feature_type_with_metadata["id_column"] == expected_type["id_column"]
    )
    metadata_dataset_id = feature_type_with_metadata["dataset"]["id"]
    assert metadata_dataset_id is not None and len(metadata_dataset_id) == 36

    # Both the Dimension and TabularColumn tables should have a record for each annotation
    assert (
        len(minimal_db.query(Dimension).filter_by(dataset_id=metadata_dataset_id).all())
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=metadata_dataset_id)
            .all()
        )
        == 3
    )
    assert minimal_db.query(TabularCell).count() == 6 + orig_cell_count


def test_add_existing_feature_type(client: TestClient, settings):
    # make sure we start with nothing
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    response = client.get("/types/feature")
    assert_status_ok(response)
    assert response.json() == []

    # add a feature type
    response = client.post(
        "/types/feature",
        data={"name": "gene", "id_column": "gene_id"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.content
    # add a feature type duplicate
    response2 = client.post(
        "/types/feature",
        data={"name": "gene", "id_column": "gene_id"},
        headers=admin_headers,
    )
    assert_status_not_ok(response2)


def test_add_invalid_metadata_file(client: TestClient, settings):
    # Test id_column and label (for feature metadata) in file
    admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
    r_without_id_col_feature = client.post(
        "/types/feature",
        data={"name": "gene", "id_column": "gene_id"},
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["attr1", "label", "attr3"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_without_id_col_feature)

    r_without_label_col_feature = client.post(
        "/types/feature",
        data={"name": "gene", "id_column": "gene_id"},
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["gene_id", "attr2", "attr3"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_without_label_col_feature)

    r_without_id_col_sample = client.post(
        "/types/sample",
        data={"name": "sample", "id_column": "sample_id"},
        files={
            "metadata_file": (
                "sample_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "attr2", "attr3"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_without_id_col_sample)

    # Test id_column and label (for feature metadata) is unique
    not_unique_id = factories.tabular_csv_data_file(
        cols=["gene_id", "label", "attr3"],
        row_values=[["a", "A", 1.0], ["a", "B", 2.0]],
    )
    not_unique_label = factories.tabular_csv_data_file(
        cols=["gene_id", "label", "attr3"],
        row_values=[["a", "A", 1.0], ["b", "A", 2.0]],
    )
    for metadata in [not_unique_id, not_unique_label]:
        r_not_unique_feature = client.post(
            "/types/feature",
            data={"name": "gene", "id_column": "gene_id"},
            files={"metadata_file": ("feature_metadata", metadata, "text/csv",)},
            headers=admin_headers,
        )
        assert_status_not_ok(r_not_unique_feature)

    r_not_unique_sample = client.post(
        "/types/sample",
        data={"name": "sample", "id_column": "sample_id"},
        files={
            "metadata_file": (
                "sample_metadata",
                factories.tabular_csv_data_file(
                    cols=["sample_id", "label", "attr3"],
                    row_values=[["a", "A", 1.0], ["a", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_not_unique_sample)

    # Test no holes in the id or label (for feature metadata) column
    holes_id = factories.tabular_csv_data_file(
        cols=["gene_id", "label", "attr3"],
        row_values=[["a", "A", 1.0], [None, "B", 2.0]],
    )
    holes_label = factories.tabular_csv_data_file(
        cols=["gene_id", "label", "attr3"],
        row_values=[["a", "A", 1.0], ["b", None, 2.0]],
    )
    for metadata in [holes_id, holes_label]:
        r_holes_feature = client.post(
            "/types/feature",
            data={"name": "gene", "id_column": "gene_id"},
            files={"metadata_file": ("feature_metadata", metadata, "text/csv",)},
            headers=admin_headers,
        )
        assert_status_not_ok(r_holes_feature)

    r_holes_sample = client.post(
        "/types/sample",
        data={"name": "sample", "id_column": "sample_id"},
        files={
            "metadata_file": (
                "sample_metadata",
                factories.tabular_csv_data_file(
                    cols=["sample_id", "label", "attr3"],
                    row_values=[["a", "A", 1.0], [None, "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_holes_sample)


def test_update_metadata(client: TestClient, minimal_db, settings):
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    factories.sample_type(minimal_db, user, "other_sample")

    # Add metadata to existing sample type
    r_update_sample_1 = client.patch(
        f"/types/sample/other_sample/metadata",
        data={
            "name": "other_sample",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_update_sample_1)
    r_update_sample_1 = r_update_sample_1.json()
    other_sample_dataset_id = r_update_sample_1["dataset"]["id"]
    assert other_sample_dataset_id is not None

    def assert_metadata_row_counts(
        other_sample_dataset_id: str,
        expected_name: str,
        expected_rows,
        expected_cols,
        expected_NAs,
    ):
        assert (
            minimal_db.query(Dimension)
            .filter_by(dataset_id=other_sample_dataset_id)
            .count()
            == expected_cols
        )
        assert (
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=other_sample_dataset_id)
            .count()
            == expected_cols
        )
        columns_within_dataset_query = (
            minimal_db.query(TabularColumn)
            .join(TabularDataset)
            .filter(TabularDataset.id == other_sample_dataset_id)
        )
        cells_within_dataset_query = (
            minimal_db.query(TabularCell)
            .join(TabularColumn)
            .join(TabularDataset)
            .filter(TabularDataset.id == other_sample_dataset_id)
        )
        label_metadata_column = columns_within_dataset_query.filter(
            TabularColumn.given_id == "label"
        ).one()
        assert label_metadata_column
        assert cells_within_dataset_query.count() == expected_cols * expected_rows
        assert (
            cells_within_dataset_query.filter(
                TabularCell.tabular_column_id == label_metadata_column.id
            ).count()
            == expected_rows
        )
        updated_dataset = (
            minimal_db.query(Dataset)
            .filter(Dataset.id == other_sample_dataset_id)
            .one()
        )
        assert updated_dataset.name == expected_name

    updated_sample_1 = (
        minimal_db.query(DimensionType)
        .filter_by(name="other_sample", axis="sample")
        .one()
    )

    assert (
        updated_sample_1.dataset is not None
        and updated_sample_1.dataset.name == "sample_metadata"
    )
    assert_metadata_row_counts(other_sample_dataset_id, "sample_metadata", 2, 3, 1)

    # Test update/overwrite metadata with new metadata
    r_update_sample_2 = client.patch(
        "/types/sample/other_sample/metadata",
        data={
            "name": "other_sample",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata_2",
                factories.tabular_csv_data_file(
                    cols=["label", "id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_update_sample_2)
    r_update_sample_2 = r_update_sample_2.json()
    # make sure the dataset ID changes each time data changes
    assert r_update_sample_2["dataset"]["id"] != r_update_sample_1["dataset"]["id"]
    other_sample_dataset_id = r_update_sample_2["dataset"]["id"]
    assert r_update_sample_2["name"] == r_update_sample_1["name"]
    updated_sample_2 = (
        minimal_db.query(DimensionType)
        .filter_by(name="other_sample", axis="sample")
        .one()
    )
    assert (
        updated_sample_2.dataset is not None
        and updated_sample_2.dataset.name == "sample_metadata_2"
    )
    assert_metadata_row_counts(other_sample_dataset_id, "sample_metadata_2", 2, 3, 1)

    factories.feature_type(minimal_db, settings.admin_users[0], "other_feature")
    r_update_feature_1 = client.patch(
        "/types/feature/other_feature/metadata",
        data={
            "name": "other_feature",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_update_feature_1)
    other_feature_metadata_id = r_update_feature_1.json()["dataset"]["id"]
    assert_metadata_row_counts(other_feature_metadata_id, "feature_metadata", 2, 3, 1)

    r_update_feature_2 = client.patch(
        "/types/feature/other_feature/metadata",
        data={
            "name": "other_feature",
            "annotation_type_mapping": json.dumps(
                {"annotation_type_mapping": {"label": "text", "id": "text",}}
            ),
        },
        files={
            "metadata_file": (
                "new_feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "id"],
                    row_values=[["a", "A"], ["b", "B"], ["c", "C"]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_update_feature_2)
    other_feature_metadata_id = r_update_feature_2.json()["dataset"]["id"]
    assert_metadata_row_counts(
        other_feature_metadata_id, "new_feature_metadata", 3, 2, 0
    )

    r_update_generic_feature = client.patch(
        "/types/feature/generic/metadata",
        data={
            "name": "generic",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_update_generic_feature)


def test_metadata_dataset(client: TestClient, minimal_db, settings):
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    r_sample_with_metadata = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert r_sample_with_metadata.status_code == 200, r_sample_with_metadata.content
    sample_metadata = minimal_db.query(Dataset).get(
        r_sample_with_metadata.json()["dataset"]["id"]
    )
    assert sample_metadata
    sample_metadata_id = sample_metadata.id
    assert (
        len(minimal_db.query(Dimension).filter_by(dataset_id=sample_metadata_id).all())
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=sample_metadata_id)
            .all()
        )
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularCell)
            .join(TabularColumn)
            .filter_by(dataset_id=sample_metadata_id)
            .all()
        )
        == 6
    )

    r_feature_with_metadata = client.post(
        "/types/feature",
        data={
            "name": "gene",
            "id_column": "entrez_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "entrez_id": "text",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "feature_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "entrez_id", "attr2"],
                    row_values=[["a", "A", 1.0], ["b", "B", None]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert r_feature_with_metadata.status_code == 200, r_feature_with_metadata.content
    feature_metadata = minimal_db.query(Dataset).get(
        r_feature_with_metadata.json()["dataset"]["id"]
    )
    assert feature_metadata
    feature_metadata_id = feature_metadata.id
    assert (
        len(minimal_db.query(Dimension).filter_by(dataset_id=feature_metadata_id).all())
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=feature_metadata_id)
            .all()
        )
        == 3
    )
    label_metadata_column = (
        minimal_db.query(TabularColumn)
        .filter(
            and_(
                TabularColumn.given_id == "label",
                TabularColumn.dataset_id == feature_metadata_id,
            )
        )
        .one()
    )
    assert label_metadata_column
    assert (
        len(
            minimal_db.query(TabularCell)
            .join(TabularColumn)
            .filter_by(dataset_id=sample_metadata_id)
            .all()
        )
        == 6
    )
    assert (
        len(
            minimal_db.query(TabularCell)
            .filter(TabularCell.tabular_column_id == label_metadata_column.id)
            .all()
        )
        == 2
    )

    # delete
    delete_sample_metadata = client.delete(
        f"datasets/{sample_metadata.id}",
        headers={"X-Forwarded-Email": "anyone@broadinstitute.org"},
    )
    delete_feature_metadata = client.delete(
        f"datasets/{feature_metadata.id}",
        headers={"X-Forwarded-Email": "anyone@broadinstitute.org"},
    )
    assert (
        delete_sample_metadata.status_code == 403
        and delete_feature_metadata.status_code == 403
    )


def test_bad_dimension_type_id_mapping(client: TestClient, settings):
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}

    # Add a gene feature type to attempt point to.
    gene_feature_type_response = client.post(
        "/types/feature",
        data={
            "name": "gene",
            "id_column": "entrez_id",
            "properties_to_index": ["entrez_id"],
            "annotation_type_mapping": json.dumps(
                {"annotation_type_mapping": {"label": "text", "entrez_id": "text",}}
            ),
        },
        files={
            "metadata_file": (
                "gene_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "entrez_id", "aliases"],
                    row_values=[["a", "A", "test",]],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )

    # Try to add an id_mapping that refers to a reference column that does not exist
    compound_feature_type_response_BAD_MAPPING = client.post(
        "/types/feature",
        data={
            "name": "compound",
            "id_column": "compound_id",
            "properties_to_index": ["compound_id", "label"],
            "annotation_type_mapping": json.dumps(
                {"annotation_type_mapping": {"label": "text", "compound_id": "text",}}
            ),
            "id_mapping": json.dumps(
                {
                    "id_mapping": {
                        "reference_column_mappings": {"target": "BADSPELLINGgene"}
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "compound_metadata",
                factories.tabular_csv_data_file(
                    cols=["label", "compound_id"],
                    row_values=[["ab", "AB"], ["b", "B"],],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )

    assert compound_feature_type_response_BAD_MAPPING.status_code == 400
    assert compound_feature_type_response_BAD_MAPPING.json() == {
        "detail": "Attempted reference mapping to a dimension type that does not exist!"
    }


def test_metadata_dataset_with_str_list_values(
    client: TestClient, minimal_db, settings
):
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    r_sample_with_list_annotations = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                        "list_vals": "list_strings",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2", "list_vals"],
                    row_values=[
                        ["a", "ACH-1", 1.0, '["hi", "bye"]'],
                        ["b", "ACH-2", 2.0, "[]"],
                        ["c", "ACH-3", 2.0, np.nan],
                        ["d", "ACH-4", 1.0, '["hi", "bye"]'],
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_sample_with_list_annotations)
    assert r_sample_with_list_annotations.status_code == 200

    sample_metadata = minimal_db.query(Dataset).get(
        r_sample_with_list_annotations.json()["dataset"]["id"]
    )
    assert sample_metadata
    sample_metadata_id = sample_metadata.id

    list_vals_annotation = (
        minimal_db.query(TabularColumn)
        .filter(
            TabularColumn.given_id == "list_vals",
            TabularColumn.dataset_id == sample_metadata_id,
        )
        .one()
    )
    ACH1_list_vals = (
        minimal_db.query(TabularCell)
        .filter(
            and_(
                TabularCell.tabular_column_id == list_vals_annotation.id,
                TabularCell.dimension_given_id == "ACH-1",
            )
        )
        .one()
        .value
    )
    assert ACH1_list_vals == '["hi", "bye"]'
    ACH2_list_vals = (
        minimal_db.query(TabularCell)
        .filter(
            and_(
                TabularCell.tabular_column_id == list_vals_annotation.id,
                TabularCell.dimension_given_id == "ACH-2",
            )
        )
        .one()
        .value
    )
    assert ACH2_list_vals == "[]"
    ACH3_list_vals = (
        minimal_db.query(TabularCell)
        .filter(
            and_(
                TabularCell.tabular_column_id == list_vals_annotation.id,
                TabularCell.dimension_given_id == "ACH-3",
            )
        )
        .one()
        .value
    )
    assert ACH3_list_vals == None
    r_all_strings = client.post(
        "/types/sample",
        data={
            "name": "test",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                        "list_vals": "list_strings",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2", "list_vals"],
                    row_values=[
                        ["a", "ACH-1", 1.0, '["hi", "1"]',],  # numeric strings are ok
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_ok(r_all_strings)
    assert r_all_strings.status_code == 200


def test_metadata_dataset_with_bad_list_values(
    client: TestClient, minimal_db, settings
):
    user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-Email": user}
    r_bad_quotes = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                        "list_vals": "list_strings",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2", "list_vals"],
                    row_values=[
                        [
                            "a",
                            "ACH-1",
                            1.0,
                            "['hi', 'bye']",
                        ],  # strings in list must be in "" not '' to properly json decode
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_bad_quotes)
    assert r_bad_quotes.status_code == 400

    r_not_all_strings = client.post(
        "/types/sample",
        data={
            "name": "sample",
            "id_column": "sample_id",
            "annotation_type_mapping": json.dumps(
                {
                    "annotation_type_mapping": {
                        "label": "text",
                        "attr2": "continuous",
                        "sample_id": "text",
                        "list_vals": "list_strings",
                    }
                }
            ),
        },
        files={
            "metadata_file": (
                "sample_metadata.csv",
                factories.tabular_csv_data_file(
                    cols=["label", "sample_id", "attr2", "list_vals"],
                    row_values=[
                        [
                            "a",
                            "ACH-1",
                            1.0,
                            '["hi", 1]',
                        ],  # strings in list must be not be numeric
                    ],
                ),
                "text/csv",
            )
        },
        headers=admin_headers,
    )
    assert_status_not_ok(r_not_all_strings)
    assert r_not_all_strings.status_code == 400


def test_get_dimension_type_identifiers_etag(client: TestClient, minimal_db, settings):
    headers = {"X-Forwarded-Email": settings.admin_users[0]}
    url = "types/dimensions/depmap_model/identifiers"

    first = client.get(url, headers=headers)
    assert_status_ok(first)
    etag = first.headers["ETag"]

    # unchanged -> 304
    second = client.get(url, headers={**headers, "If-None-Match": etag})
    assert second.status_code == 304

    # changing the dimension type invalidates the etag
    updated = client.patch(
        "types/dimensions/depmap_model",
        json={"display_name": "renamed"},
        headers=headers,
    )
    assert_status_ok(updated)
    third = client.get(url, headers={**headers, "If-None-Match": etag})
    assert third.status_code == 200
    assert third.headers["ETag"] != etag

    # as does adding a dataset
    etag = third.headers["ETag"]
    factories.matrix_dataset(minimal_db, settings)
    fourth = client.get(url, headers={**headers, "If-None-Match": etag})
    assert fourth.status_code == 200
    assert fourth.headers["ETag"] != etag


def _reference_graph_fixture(db, settings):
    admin = settings.admin_users[0]
    factories.feature_type(db, admin, "gene", display_name="Gene")
    factories.sample_type(
        db,
        admin,
        "screen",
        display_name="Screen",
        given_ids=["S1"],
        metadata_given_id="screen_metadata",
    )
    return factories.tabular_dataset(
        db,
        settings,
        index_type_name="screen",
        given_id="screen_extras",
        name="Screen extras",
        data_df=pd.DataFrame(
            {
                "id": ["S1"],
                "label": ["S1"],
                "GeneID": ["G1"],
                "Genes": [json.dumps(["G1", "G2"])],
            }
        ),
        columns_metadata={
            "id": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "GeneID": ColumnMetadata(col_type=AnnotationType.text, references="gene"),
            "Genes": ColumnMetadata(
                col_type=AnnotationType.list_strings, references="gene"
            ),
        },
    )


def test_reference_graph(client: TestClient, minimal_db, settings):
    _reference_graph_fixture(minimal_db, settings)

    response = client.get(
        "types/dimensions/reference-graph",
        headers={"X-Forwarded-Email": "anyone@example.com"},
    )
    assert_status_ok(response)
    nodes = {n["name"]: n for n in response.json()["dimension_types"]}

    screen = nodes["screen"]
    assert screen["display_name"] == "Screen"
    primary, extras = screen["tables"]
    assert primary["is_primary"] is True
    assert primary["slice_dataset_id"] == "screen_metadata"
    assert primary["references"] == []
    assert screen["metadata_dataset_id"] == primary["id"]

    assert extras["is_primary"] is False
    assert extras["slice_dataset_id"] == "screen_extras"
    assert extras["references"] == [
        {"column": "GeneID", "target_type": "gene", "cardinality": "scalar"},
        {"column": "Genes", "target_type": "gene", "cardinality": "list"},
    ]

    # a type with no tables and no references (a hub) is still listed
    assert nodes["gene"]["tables"] == []
    assert nodes["gene"]["metadata_dataset_id"] is None


def test_reference_graph_slice_dataset_id_falls_back_to_id(
    client: TestClient, minimal_db, settings
):
    dataset = _reference_graph_fixture(minimal_db, settings)
    other = factories.tabular_dataset(
        minimal_db,
        settings,
        index_type_name="screen",
        data_df=pd.DataFrame({"id": ["S1"], "label": ["S1"]}),
        columns_metadata={
            "id": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
        },
    )

    response = client.get(
        "types/dimensions/reference-graph",
        headers={"X-Forwarded-Email": "anyone@example.com"},
    )
    tables = {
        t["id"]: t
        for t in next(
            n for n in response.json()["dimension_types"] if n["name"] == "screen"
        )["tables"]
    }
    assert tables[other.id]["given_id"] is None
    assert tables[other.id]["slice_dataset_id"] == other.id
    assert tables[dataset.id]["slice_dataset_id"] == "screen_extras"


def test_reference_graph_hides_private_tables(
    client: TestClient, minimal_db, settings, private_group
):
    _reference_graph_fixture(minimal_db, settings)
    factories.tabular_dataset(
        minimal_db,
        settings,
        index_type_name="screen",
        given_id="private_screen_table",
        group_id=private_group["id"],
        data_df=pd.DataFrame({"id": ["S1"], "label": ["S1"], "SecretGeneID": ["G1"]}),
        columns_metadata={
            "id": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "SecretGeneID": ColumnMetadata(
                col_type=AnnotationType.text, references="gene"
            ),
        },
        user=settings.admin_users[0],
    )

    def screen_table_ids(email):
        response = client.get(
            "types/dimensions/reference-graph", headers={"X-Forwarded-Email": email},
        )
        assert_status_ok(response)
        screen = next(
            n for n in response.json()["dimension_types"] if n["name"] == "screen"
        )
        return {t["slice_dataset_id"] for t in screen["tables"]}

    assert "private_screen_table" not in screen_table_ids("anyone@example.com")
    assert "private_screen_table" in screen_table_ids("someone@private-group.com")


def _reachable_fixture(db, settings):
    """
    pair --CtrlArmScreenID/TestArmScreenID--> screen
    screen --ModelConditionID--> mcond --ModelID--> model, and screen --ModelID--> model
    pair also has a supplemental table with a direct ModelID and a list-valued
    ScreenList.
    """
    admin = settings.admin_users[0]
    text = AnnotationType.text

    def add_type(name, extra_cols, refs, rows):
        cols = {"ID": text, "label": text, **extra_cols}
        factories.add_dimension_type(
            db,
            settings,
            user=admin,
            name=name,
            display_name=name.title(),
            id_column="ID",
            axis="sample",
            annotation_type_mapping=cols,
            reference_column_mappings=refs,
            metadata_df=pd.DataFrame(
                {"ID": [r[0] for r in rows], "label": [r[0] for r in rows]}
                | {col: [r[i + 1] for r in rows] for i, col in enumerate(extra_cols)}
            ),
        )

    add_type("rmodel", {"Lineage": text}, {}, [("M1", "Breast"), ("M2", "Lung")])
    add_type(
        "rmcond", {"ModelID": text}, {"ModelID": "rmodel"}, [("C1", "M1"), ("C2", "M2")]
    )
    add_type(
        "rscreen",
        {"ModelID": text, "ModelConditionID": text},
        {"ModelID": "rmodel", "ModelConditionID": "rmcond"},
        [("S1", "M1", "C1"), ("S2", "M2", "C2")],
    )
    add_type(
        "rpair",
        {"CtrlArmScreenID": text, "TestArmScreenID": text},
        {"CtrlArmScreenID": "rscreen", "TestArmScreenID": "rscreen"},
        [("P1", "S1", "S2")],
    )
    factories.tabular_dataset(
        db,
        settings,
        given_id="rpair_extra",
        name="Pair extra",
        index_type_name="rpair",
        data_df=pd.DataFrame(
            {
                "ID": ["P1"],
                "label": ["P1"],
                "ModelID": ["M1"],
                "ScreenList": ['["S1", "S2"]'],
            }
        ),
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "ModelID": ColumnMetadata(
                col_type=AnnotationType.text, references="rmodel"
            ),
            "ScreenList": ColumnMetadata(
                col_type=AnnotationType.list_strings, references="rscreen"
            ),
        },
    )


def _route(routes, start, columns):
    return next(
        r
        for r in routes
        if r["start_table"] == start and [h["column"] for h in r["hops"]] == columns
    )


def test_reachable_routes(client: TestClient, minimal_db, settings):
    _reachable_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}

    response = client.get("types/dimensions/rpair/reachable", headers=headers)
    assert_status_ok(response)
    body = response.json()
    routes = body["routes"]
    primary_id = next(r["start_table"] for r in routes if not r["hops"])

    # The two arms are distinct routes to the same table.
    ctrl = _route(routes, primary_id, ["CtrlArmScreenID"])
    test = _route(routes, primary_id, ["TestArmScreenID"])
    assert ctrl["tables"][0]["slice_query_template"] != (
        test["tables"][0]["slice_query_template"]
    )

    # Multi-hop route with the template nested innermost-first.
    deep = _route(
        routes, primary_id, ["CtrlArmScreenID", "ModelConditionID", "ModelID"]
    )
    (model_table,) = deep["tables"]
    template = model_table["slice_query_template"]
    assert template["dataset_id"] == model_table["slice_dataset_id"]
    assert template["identifier_type"] == "column"
    chain = template["reindex_through"]
    assert chain["identifier"] == "ModelID"
    assert chain["reindex_through"]["identifier"] == "ModelConditionID"
    assert (
        chain["reindex_through"]["reindex_through"]["identifier"] == "CtrlArmScreenID"
    )
    assert chain["reindex_through"]["reindex_through"].get("reindex_through") is None
    assert "Lineage" in [c["name"] for c in model_table["columns"]]
    assert model_table["offered_by_picker"] is True

    # screen -> model: the direct ModelID is a shortcut, so it is listed but not
    # offered by the picker; the route through the condition is.
    via_cond = _route(
        routes, primary_id, ["CtrlArmScreenID", "ModelConditionID", "ModelID"]
    )
    direct = _route(routes, primary_id, ["CtrlArmScreenID", "ModelID"])
    assert via_cond["tables"][0]["offered_by_picker"] is True
    assert direct["tables"][0]["offered_by_picker"] is False

    # Supplemental start table, with a list-valued hop.
    listed = _route(routes, "rpair_extra", ["ScreenList"])
    assert listed["hops"][0]["cardinality"] == "list"
    assert listed["result_is_list"] is True
    assert _route(routes, primary_id, ["CtrlArmScreenID"])["result_is_list"] is False

    # A hub has no outgoing routes: model only lists its own table.
    hub = client.get("types/dimensions/rmodel/reachable", headers=headers).json()
    assert all(not r["hops"] for r in hub["routes"])


def test_reachable_max_depth(client: TestClient, minimal_db, settings):
    _reachable_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}

    def depths(max_depth):
        r = client.get(
            f"types/dimensions/rpair/reachable?max_depth={max_depth}", headers=headers
        )
        assert_status_ok(r)
        return {len(route["hops"]) for route in r.json()["routes"]}

    assert depths(0) == {0}
    assert depths(1) == {0, 1}
    assert max(depths(9)) == 3  # the graph's longest chain

    assert (
        client.get(
            "types/dimensions/rpair/reachable?max_depth=10", headers=headers
        ).status_code
        == 422
    )
    assert (
        client.get("types/dimensions/nope/reachable", headers=headers).status_code
        == 404
    )


def test_reachable_templates_resolve(client: TestClient, minimal_db, settings):
    """Every route and column the endpoint advertises must resolve."""
    _reachable_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}
    body = client.get(
        "types/dimensions/rpair/reachable?max_depth=9", headers=headers
    ).json()

    checked = 0
    for route in body["routes"]:
        for table in route["tables"]:
            for column in table["columns"]:
                query = {
                    **table["slice_query_template"],
                    "identifier": column["name"],
                }
                response = client.post(
                    "/datasets/dimension/data", json=query, headers=headers
                )
                assert response.status_code == 200, (
                    route["hops"],
                    query,
                    response.text,
                )
                checked += 1

    assert checked > 20


def test_reachable_hides_private_tables(
    client: TestClient, minimal_db, settings, private_group
):
    _reachable_fixture(minimal_db, settings)
    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="rpair_private",
        index_type_name="rpair",
        group_id=private_group["id"],
        data_df=pd.DataFrame({"ID": ["P1"], "label": ["P1"], "SecretModel": ["M1"]}),
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "SecretModel": ColumnMetadata(
                col_type=AnnotationType.text, references="rmodel"
            ),
        },
        user=settings.admin_users[0],
    )

    def start_tables(email):
        response = client.get(
            "types/dimensions/rpair/reachable", headers={"X-Forwarded-Email": email}
        )
        assert_status_ok(response)
        return {r["start_table"] for r in response.json()["routes"]}

    assert "rpair_private" not in start_tables("anyone@example.com")
    assert "rpair_private" in start_tables("someone@private-group.com")


def _dose_fixture(db, settings):
    """
    rdose --CompoundID--> rcompound: many dose rows per compound, plus a matrix
    indexed by rdose (a dose-level matrix) and a second list-valued child.
    """
    admin = settings.admin_users[0]
    text = AnnotationType.text

    factories.add_dimension_type(
        db,
        settings,
        user=admin,
        name="rcompound",
        display_name="Compound",
        id_column="ID",
        axis="feature",
        annotation_type_mapping={"ID": text, "label": text},
        reference_column_mappings={},
        metadata_df=pd.DataFrame({"ID": ["C1", "C2"], "label": ["C1", "C2"]}),
    )
    factories.add_dimension_type(
        db,
        settings,
        user=admin,
        name="rdose",
        display_name="Compound Dose",
        id_column="ID",
        axis="feature",
        annotation_type_mapping={
            "ID": text,
            "label": text,
            "CompoundID": text,
            "Dose": text,
        },
        reference_column_mappings={"CompoundID": "rcompound"},
        metadata_df=pd.DataFrame(
            {
                "ID": ["D1", "D2", "D3"],
                "label": ["D1", "D2", "D3"],
                "CompoundID": ["C1", "C1", "C2"],
                "Dose": ["0.1", "1", "0.1"],
            }
        ),
    )
    factories.tabular_dataset(
        db,
        settings,
        given_id="rcompound_panels",
        name="Compound panels",
        index_type_name="rcompound",
        data_df=pd.DataFrame(
            {"ID": ["C1", "C2"], "label": ["C1", "C2"], "Related": ['["C2"]', '["C1"]']}
        ),
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "Related": ColumnMetadata(
                col_type=AnnotationType.list_strings, references="rcompound"
            ),
        },
    )
    factories.sample_type(
        db, admin, "rline", display_name="Line", given_ids=["L1", "L2"]
    )
    factories.matrix_dataset(
        db,
        settings,
        feature_type="rdose",
        sample_type="rline",
        given_id="dose_matrix",
        dataset_name="Dose matrix",
        data_file=factories.continuous_matrix_csv_file(
            feature_ids=["D1", "D2", "D3"], sample_ids=["L1", "L2"]
        ),
    )


def test_referenced_by(client: TestClient, minimal_db, settings):
    _dose_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}

    body = client.get(
        "types/dimensions/rcompound/referenced-by", headers=headers
    ).json()
    assert body["type"] == "rcompound"
    by_name = {t["name"]: t for t in body["referenced_by"]}
    # the type itself appears: rcompound_panels.Related is a self-reference
    assert sorted(by_name) == ["rcompound", "rdose"]

    dose = by_name["rdose"]
    assert dose["display_name"] == "Compound Dose"
    assert dose["axis"] == "feature"
    (table,) = dose["tables"]
    assert table["is_primary"] is True
    assert dose["metadata_dataset_id"] == table["id"]
    assert [c["name"] for c in table["columns"]] == [
        "CompoundID",
        "Dose",
        "ID",
        "label",
    ]
    assert table["references"] == [
        {
            "column": "CompoundID",
            "cardinality": "scalar",
            "relationship_from_child": "many_to_one",
            "relationship_from_parent": "one_to_many",
        }
    ]
    assert "slice_query_template" not in table

    (panels,) = by_name["rcompound"]["tables"]
    assert panels["is_primary"] is False
    assert panels["references"] == [
        {
            "column": "Related",
            "cardinality": "list",
            "relationship_from_child": "many_to_many",
            "relationship_from_parent": "many_to_many",
        }
    ]

    # nothing references rdose
    leaf = client.get("types/dimensions/rdose/referenced-by", headers=headers).json()
    assert leaf["referenced_by"] == []

    assert (
        client.get("types/dimensions/nope/referenced-by", headers=headers).status_code
        == 404
    )


def test_referenced_by_columns_resolve(client: TestClient, minimal_db, settings):
    """Every advertised child column loads as a plain slice, and the reverse edge
    is the mirror of a forward route that `reachable` lists and the resolver accepts."""
    _dose_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}
    body = client.get(
        "types/dimensions/rcompound/referenced-by", headers=headers
    ).json()

    checked = 0
    for child in body["referenced_by"]:
        for table in child["tables"]:
            for column in table["columns"]:
                query = {
                    "dataset_id": table["slice_dataset_id"],
                    "identifier_type": "column",
                    "identifier": column["name"],
                }
                response = client.post(
                    "/datasets/dimension/data", json=query, headers=headers
                )
                assert response.status_code == 200, (query, response.text)
                checked += 1
            for ref in table["references"]:
                if child["name"] == "rcompound":
                    # Self-references are listed here but are not forward routes:
                    # the resolver rejects revisiting a type.
                    continue
                forward = client.get(
                    f"types/dimensions/{child['name']}/reachable", headers=headers
                ).json()
                assert any(
                    r["start_table"] == table["slice_dataset_id"]
                    and [(h["column"], h["target_type"]) for h in r["hops"]]
                    == [(ref["column"], "rcompound")]
                    for r in forward["routes"]
                ), ref
    assert checked == 7


def test_reverse_routes_are_not_resolvable(client: TestClient, minimal_db, settings):
    """Why referenced-by carries no templates: a chain from the parent through
    the child's FK column does not resolve to child-level values."""
    _dose_fixture(minimal_db, settings)
    headers = {"X-Forwarded-Email": "anyone@example.com"}
    query = {
        "dataset_id": "rdose_metadata",
        "identifier_type": "column",
        "identifier": "Dose",
        "reindex_through": {
            "dataset_id": "rdose_metadata",
            "identifier": "CompoundID",
            "identifier_type": "column",
        },
    }
    response = client.post("/datasets/dimension/data", json=query, headers=headers)
    # Either rejected or silently empty, never one value per dose.
    assert response.status_code != 200 or response.json()["values"] == []


def test_reference_graph_lists_matrix_datasets(
    client: TestClient, minimal_db, settings
):
    _dose_fixture(minimal_db, settings)
    body = client.get(
        "types/dimensions/reference-graph",
        headers={"X-Forwarded-Email": "anyone@example.com"},
    ).json()
    matrices = {m["slice_dataset_id"]: m for m in body["matrix_datasets"]}
    dose = matrices["dose_matrix"]
    assert dose["name"] == "Dose matrix"
    assert dose["feature_type"] == "rdose"
    assert dose["sample_type"] == "rline"
    # tabular datasets stay under their type, not in matrix_datasets
    assert "rdose_metadata" not in matrices


def test_referenced_by_hides_private_tables(
    client: TestClient, minimal_db, settings, private_group
):
    _dose_fixture(minimal_db, settings)
    factories.tabular_dataset(
        minimal_db,
        settings,
        given_id="rdose_private",
        index_type_name="rdose",
        group_id=private_group["id"],
        data_df=pd.DataFrame({"ID": ["D1"], "label": ["D1"], "Secret": ["C1"]}),
        columns_metadata={
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "label": ColumnMetadata(col_type=AnnotationType.text),
            "Secret": ColumnMetadata(
                col_type=AnnotationType.text, references="rcompound"
            ),
        },
        user=settings.admin_users[0],
    )

    def tables(email):
        body = client.get(
            "types/dimensions/rcompound/referenced-by",
            headers={"X-Forwarded-Email": email},
        ).json()
        return {
            t["slice_dataset_id"] for c in body["referenced_by"] for t in c["tables"]
        }

    assert "rdose_private" not in tables("anyone@example.com")
    assert "rdose_private" in tables("someone@private-group.com")


def test_contract_schema_covers_compound_dose():
    """The checked-in schema keeps compound_dose (a synthetic child of compound_v2),
    so Delphi's acceptance test sees the many-to-one case."""
    from breadbox.service.reference_graph import build_referenced_by

    tables = _contract_tables()
    types = [
        DimensionType(name=n, display_name=n, axis="feature") for n in sorted(tables)
    ]
    body = build_referenced_by(types, tables, "compound_v2")
    dose = next(t for t in body.referenced_by if t.name == "compound_dose")
    (table,) = dose.tables
    assert table.is_primary
    assert [r.column for r in table.references] == ["CompoundID"]
    assert "Dose" in [c["name"] for c in table.columns]

    forward = build_reachable(tables, "compound_dose", MAX_HOPS)
    assert any(
        [(h.column, h.target_type) for h in r.hops] == [("CompoundID", "compound_v2")]
        for r in forward.routes
    )


CONTRACT_DIR = Path(__file__).parent.parent / "fixtures" / "reference_graph"


def _contract_tables():
    """Tables from the checked-in copy of the live schema, as the service sees them."""
    schema = json.loads((CONTRACT_DIR / "schema.json").read_text())
    primary = {t["name"]: t["metadata_dataset_id"] for t in schema["dimension_types"]}
    tables = {name: [] for name in primary}
    for d in schema["tabular_datasets"]:
        tables[d["index_type_name"]].append(
            LoadedTable(
                id=d["id"],
                given_id=d["given_id"],
                name=d["name"],
                data_type="",
                index_type=d["index_type_name"],
                is_primary=primary[d["index_type_name"]] == d["id"],
                columns=tuple(
                    LoadedColumn(name, m["col_type"], m["references"])
                    for name, m in sorted(d["columns_metadata"].items())
                ),
            )
        )
    for group in tables.values():
        group.sort(key=lambda t: (not t.is_primary, t.name, t.id))
    return tables


def _contract_projection(reachable):
    """
    One line per reachable table, so the fixture stays small and diffs well:

        offered | first_hop_table.fk > next_hop_table.fk | end_table | list

    The hops are the template's own `reindex_through` chain read innermost
    first, so what is checked is the SliceQuery a caller would use. Columns are
    not repeated; they come from schema.json. `list` is present when
    `result_is_list` is true.
    """
    lines = []
    for route in reachable.routes:
        for table in route.tables:
            template = table.slice_query_template
            steps = []
            node = template.reindex_through
            while node is not None:
                assert node.identifier_type == "column"
                steps.append(f"{node.dataset_id}.{node.identifier}")
                node = node.reindex_through
            steps.reverse()
            assert template.identifier_type == "column"
            assert [h.column for h in route.hops] == [s.split(".", 1)[1] for s in steps]
            lines.append(
                " | ".join(
                    [
                        "offered" if table.offered_by_picker else "not offered",
                        " > ".join(steps),
                        template.dataset_id,
                        "list" if route.result_is_list else "scalar",
                    ]
                )
            )
    return sorted(lines)


def test_reachable_matches_contract_fixture():
    """
    reachable.json is the other half of the cross-language contract test: the
    Jest test AnnotationSelect/__tests__/referenceGraphContract.test.ts checks
    that the annotation picker agrees with it. Any change to what the endpoint
    returns for the live schema shows up here as a diff. To accept a change:

        UPDATE_CONTRACT_FIXTURES=1 pytest tests/api/test_types.py -k contract
    """
    tables = _contract_tables()
    actual = {
        dim: _contract_projection(build_reachable(tables, dim, MAX_HOPS))
        for dim in sorted(tables)
    }
    path = CONTRACT_DIR / "reachable.json"

    if os.environ.get("UPDATE_CONTRACT_FIXTURES"):
        path.write_text(json.dumps(actual, indent=2, sort_keys=True) + "\n")

    assert actual == json.loads(path.read_text())
