from io import BytesIO
from breadbox.schemas.types import IdMapping
from breadbox.crud.dataset import _get_impacted_dataset_ids
from fastapi.testclient import TestClient
from sqlalchemy import and_
from breadbox.models.dataset import DimensionType, Dataset
from breadbox.models.dataset import (
    Dimension,
    TabularColumn,
    TabularCell,
)
from tests import factories
import json
import numpy as np
from tests.factories import feature_type_with_metadata
from io import BytesIO
from breadbox.models.dataset import DimensionSearchIndex
from breadbox.models.dataset import AnnotationType
from breadbox.schemas.dataset import ColumnMetadata
import pandas as pd
from ..utils import assert_status_ok, assert_status_not_ok


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

    # Make sure if only metadata_dataset_id or properties_to_index is provided, throw and error. Both should be provided when dimension type metadata is changed
    response = client.patch(
        "/types/dimensions/sample_id_name",
        json=({"metadata_dataset_id": new_metadata.id}),
        headers=admin_headers,
    )
    assert_status_not_ok(response)
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

    # make sure we can delete it
    response = client.delete("/types/dimensions/sample_id_name", headers=admin_headers,)
    assert_status_ok(response)
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

    user = settings.admin_users[0]
    parent_impacted_datasets = _get_impacted_dataset_ids(db, parent.dataset_id)

    assert len(parent_impacted_datasets) == 1
    assert parent.dataset_id in parent_impacted_datasets

    child1 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child1",
        id_column="child_id1",
        metadata_df=child1_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent": "parent"}),
    )

    child1_impacted_datasets = _get_impacted_dataset_ids(db, child1.dataset_id)

    assert len(child1_impacted_datasets) == 2
    assert child1.dataset_id in child1_impacted_datasets
    assert parent.dataset_id in child1_impacted_datasets

    grandchild1 = factories.feature_type_with_metadata(
        db,
        settings,
        name="grandchild1",
        id_column="grandchild_id1",
        metadata_df=grandchild1_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"child1": "child1"}),
    )

    grandchild1_impacted_datasets = _get_impacted_dataset_ids(
        db, grandchild1.dataset_id
    )

    assert len(grandchild1_impacted_datasets) == 3
    assert grandchild1.dataset_id in grandchild1_impacted_datasets
    assert child1.dataset_id in grandchild1_impacted_datasets
    assert parent.dataset_id in grandchild1_impacted_datasets

    child2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child2",
        id_column="child_id2",
        metadata_df=child2_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent": "parent"}),
    )

    child2_impacted_datasets = _get_impacted_dataset_ids(db, child2.dataset_id)

    assert len(child2_impacted_datasets) == 2
    assert child2.dataset_id in child2_impacted_datasets
    assert parent.dataset_id in child2_impacted_datasets

    parent2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="parent2",
        id_column="parent2_id",
        metadata_df=parent2_metadata,
        properties_to_index=["label"],
    )

    parent_2_impacted_datasets = _get_impacted_dataset_ids(db, parent2.dataset_id)

    assert len(parent_2_impacted_datasets) == 1
    assert parent2.dataset_id in parent_2_impacted_datasets
    assert parent2.dataset_id in parent_2_impacted_datasets

    child_of_parent_2 = factories.feature_type_with_metadata(
        db,
        settings,
        name="child_of_parent2",
        id_column="child_of_parent2_id",
        metadata_df=child_of_parent2_metadata,
        properties_to_index=["label"],
        id_mapping=IdMapping(reference_column_mappings={"parent2": "parent2"}),
    )

    child_of_parent_2_impacted_datasets = _get_impacted_dataset_ids(
        db, child_of_parent_2.dataset_id
    )

    assert len(child_of_parent_2_impacted_datasets) == 2
    assert parent2.dataset_id in child_of_parent_2_impacted_datasets
    assert child_of_parent_2.dataset_id in child_of_parent_2_impacted_datasets


# def test_tiny(client: TestClient, settings, minimal_db):
#     from breadbox.schemas.types import AnnotationTypeMap
#     AnnotationTypeMap.model_validate({"annotation_type_mapping": {"label": "text", "attr2": "continuous", "sample_id": "text"}})
#     AnnotationTypeMap.model_validate_strings('{"annotation_type_mapping": {"label": "text", "attr2": "continuous", "sample_id": "text"}}')


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


def test_get_all_dimension_type_dimension_identifiers(
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
    expected_dim_type_res = dim_type_fields.copy()
    expected_dim_type_res["properties_to_index"] = []
    expected_dim_type_res["metadata_dataset_id"] = None
    assert dim_type_res.json() == expected_dim_type_res

    # Confirm dimension type has no dimension identifiers
    dim_type_ids_res = client.get(
        f"types/dimensions/{dim_type_fields['name']}/identifiers",
        headers=admin_headers,
    )
    assert_status_ok(dim_type_ids_res)
    assert dim_type_ids_res.json() == []

    # add a metadata table
    dim_type_metadata = factories.tabular_dataset(
        db,
        settings,
        columns_metadata={
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text),
            "sample_id": ColumnMetadata(units=None, col_type=AnnotationType.text),
        },
        index_type_name=dim_type_fields["name"],
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

    # test dim type doesn't exist
    nonexistent_dim_type_res = client.get(
        f"types/dimensions/nonexistentDimensionType/identifiers", headers=admin_headers,
    )
    assert_status_not_ok(nonexistent_dim_type_res)
    assert nonexistent_dim_type_res.status_code == 404


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
    # This only works bc we don't expect anything else in this table with minimal db but a more complex query is unnecessary here
    assert (
        len(minimal_db.query(TabularCell).join(TabularCell.tabular_column).all()) == 6
    )


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
        .filter(DimensionSearchIndex.label == "child_c")
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
    # This only works bc we don't expect anything else in this table with minimal db but a more complex query is unnecessary here
    assert (
        len(minimal_db.query(TabularCell).join(TabularCell.tabular_column).all()) == 6
    )


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
    assert_status_ok(r_update_sample_1), r_update_sample_1.status_code == 200
    r_update_sample_1 = r_update_sample_1.json()
    other_sample_dataset_id = r_update_sample_1["dataset"]["id"]
    assert other_sample_dataset_id is not None
    updated_sample_1 = (
        minimal_db.query(DimensionType)
        .filter_by(name="other_sample", axis="sample")
        .one()
    )
    assert (
        updated_sample_1.dataset is not None
        and updated_sample_1.dataset.name == "sample_metadata"
    )
    assert (
        len(
            minimal_db.query(Dimension)
            .filter_by(dataset_id=other_sample_dataset_id)
            .all()
        )
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=other_sample_dataset_id)
            .all()
        )
        == 3
    )
    label_metadata_column = (
        minimal_db.query(TabularColumn).filter(TabularColumn.given_id == "label").one()
    )
    assert label_metadata_column
    # This only works bc we don't expect anything else in this table with minimal db but a more complex query is unnecessary here
    assert len(minimal_db.query(TabularCell).all()) == 6
    assert (
        len(
            minimal_db.query(TabularCell)
            .filter(TabularCell.tabular_column_id == label_metadata_column.id)
            .all()
        )
        == 2
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter(TabularColumn.dataset_id == other_sample_dataset_id)
            .all()
        )
        == 3  # one for each for each annotation
    )
    updated_dataset = (
        minimal_db.query(Dataset).filter(Dataset.id == other_sample_dataset_id).one()
    )
    assert updated_dataset.name == "sample_metadata"

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
    assert_status_ok(r_update_sample_2), r_update_sample_2.status_code == 200
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
    assert (
        len(
            minimal_db.query(Dimension)
            .filter_by(dataset_id=other_sample_dataset_id)
            .all()
        )
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=other_sample_dataset_id)
            .all()
        )
        == 3
    )
    # This only works bc we don't expect anything else in this table with minimal db but a more complex query is unnecessary here
    assert len(minimal_db.query(TabularCell).all()) == 6
    assert (
        minimal_db.query(TabularColumn)
        .filter(TabularColumn.given_id == "attr1")
        .one_or_none()
        is None
    )
    label_column = (
        minimal_db.query(TabularColumn).filter(TabularColumn.given_id == "label").one()
    )
    assert label_column
    assert (
        len(
            minimal_db.query(TabularCell)
            .filter(TabularCell.tabular_column_id == label_metadata_column.id)
            .all()
        )
        == 0
    )
    assert (
        len(
            minimal_db.query(TabularCell)
            .filter(TabularCell.tabular_column_id == label_column.id)
            .all()
        )
        == 2
    )
    updated_dataset = (
        minimal_db.query(Dataset).filter(Dataset.id == other_sample_dataset_id).one()
    )
    assert updated_dataset.name == "sample_metadata_2"

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
    assert_status_ok(r_update_feature_1), r_update_feature_1.status_code == 200
    other_feature_metadata_id = r_update_feature_1.json()["dataset"]["id"]
    assert (
        len(
            minimal_db.query(Dimension)
            .filter_by(dataset_id=other_feature_metadata_id)
            .all()
        )
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=other_feature_metadata_id)
            .all()
        )
        == 3
    )
    label_metadata_column = (
        minimal_db.query(TabularColumn)
        .filter(
            and_(
                TabularColumn.given_id == "label",
                TabularColumn.dataset_id == other_feature_metadata_id,
            )
        )
        .one()
    )
    assert label_metadata_column
    assert (
        len(
            minimal_db.query(TabularCell)
            .join(TabularColumn)
            .filter_by(dataset_id=other_feature_metadata_id)
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
    updated_dataset = (
        minimal_db.query(Dataset).filter(Dataset.id == other_feature_metadata_id).one()
    )
    assert updated_dataset.name == "feature_metadata"

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
    assert_status_ok(r_update_feature_2), r_update_feature_2.status_code == 200
    other_feature_metadata_id = r_update_feature_2.json()["dataset"]["id"]
    assert (
        len(
            minimal_db.query(Dimension)
            .filter_by(dataset_id=other_feature_metadata_id)
            .all()
        )
        == 2
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=other_feature_metadata_id)
            .all()
        )
        == 2
    )
    label_metadata_column = (
        minimal_db.query(TabularColumn)
        .filter(
            and_(
                TabularColumn.given_id == "label",
                TabularColumn.dataset_id == other_feature_metadata_id,
            )
        )
        .one()
    )
    assert label_metadata_column
    # This only works bc we don't expect anything else in this table with minimal db but a more complex query is unnecessary here
    assert (
        len(
            minimal_db.query(TabularCell)
            .filter(TabularCell.tabular_column_id == label_metadata_column.id)
            .all()
        )
        == 3
    )
    assert (
        len(
            minimal_db.query(TabularColumn)
            .filter(TabularColumn.dataset_id == other_feature_metadata_id)
            .all()
        )
        == 2  # one for each annotation ("label" and "id")
    )
    updated_dataset = (
        minimal_db.query(Dataset).filter(Dataset.id == other_feature_metadata_id).one()
    )
    assert updated_dataset.name == "new_feature_metadata"

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
