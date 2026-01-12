import os
import json
import uuid
import numpy as np
import pandas as pd

from breadbox.crud.dimension_types import get_dimension_type
from ..factories import feature_type
from ..utils import assert_status_not_ok, assert_status_ok, assert_task_failure


from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import (
    AnnotationType,
    DatasetFeature,
    DatasetSample,
    Dataset,
    Dimension,
    MatrixDataset,
    TabularDataset,
    TabularColumn,
    TabularCell,
    ValueType,
)
from fastapi.testclient import TestClient
from breadbox.api.dependencies import get_dataset
from breadbox.io.filestore_crud import get_slice
from breadbox.models.dataset import DimensionSearchIndex
from breadbox.service.search import populate_search_index_after_update

from breadbox.models.dataset import PropertyToIndex
from breadbox.schemas.dataset import ColumnMetadata

from tests import factories
from breadbox.config import Settings
from typing import Dict
from ..utils import upload_and_get_file_ids


def assert_dimensions_response_matches(a, b):
    # made this into a function so that both values are bound to variables
    # which makes them easier to poke around in the debugger

    def sort_props(x):
        new_value = dict(x)
        new_value["matching_properties"] = sorted(
            new_value["matching_properties"], key=lambda x: x["property"]
        )
        return new_value

    a = [sort_props(x) for x in a]
    b = [sort_props(x) for x in b]

    assert a == b


class TestGet:
    def test_empty_db(self, client: TestClient):
        response = client.get("/datasets/", headers={"X-Forwarded-User": "anyone"})
        assert_status_ok(response)
        assert response.json() == []

    def test_get_by_feature_type(
        self, client: TestClient, minimal_db: SessionWithUser, settings,
    ):
        factories.feature_type(minimal_db, settings.default_user, "compound")

        # create two datasets, and make sure we only find one
        factories.matrix_dataset(minimal_db, settings)
        factories.matrix_dataset(minimal_db, settings, feature_type="compound")

        response = client.get(
            "/datasets/?feature_type=compound", headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(response)
        datasets = response.json()
        assert len(datasets) == 1
        dataset = datasets[0]
        assert dataset["feature_type_name"] == "compound"

    def test_get_by_feature(
        self, client: TestClient, minimal_db: SessionWithUser, settings, monkeypatch
    ):
        # create three datasets, and make sure we only find one
        factories.feature_type(minimal_db, settings.default_user, "compound")

        factories.matrix_dataset(minimal_db, settings, feature_type="compound")
        factories.matrix_dataset(
            minimal_db,
            settings,
            data_file=factories.continuous_matrix_csv_file(feature_ids=["a", "b"]),
        )
        expected = factories.matrix_dataset(
            minimal_db,
            settings,
            data_file=factories.continuous_matrix_csv_file(feature_ids=["a", "c"]),
        )
        factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="compound",
            data_file=factories.continuous_matrix_csv_file(feature_ids=["a", "c"]),
        )
        response = client.get(
            "/datasets/?feature_type=generic&feature_id=c",
            headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(response)
        datasets = response.json()
        assert len(datasets) == 1

        assert expected.id == datasets[0]["id"]

    def test_get_dataset_column_references(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):
        sample_type = factories.add_dimension_type(
            minimal_db,
            settings,
            settings.admin_users[0],
            name="sample-type",
            display_name="Sample Type",
            id_column="ID",
            axis="sample",
            annotation_type_mapping={"ID": AnnotationType.text},
            metadata_df=pd.DataFrame({"ID": ["ID1", "ID2"]}),
        )
        # sample_metadata = factories.tabular_dataset(minimal_db, settings, data_df=pd.DataFrame({""}), index_type_name="sample")
        dataset = factories.tabular_dataset(
            minimal_db,
            settings,
            data_df=pd.DataFrame({"ID": ["ID2"]}),
            index_type_name="sample-type",
            columns_metadata={
                "ID": ColumnMetadata(
                    col_type=AnnotationType.text, references="sample-type"
                )
            },
        )

        response = client.get(
            f"/datasets/{dataset.id}",
            headers={"X-Forwarded-User": settings.admin_users[0]},
        )
        assert_status_ok(response)
        dataset_features = response.json()
        assert dataset_features["format"] == "tabular_dataset"
        assert dataset_features["index_type_name"] == "sample-type"
        assert dataset_features["columns_metadata"] == {
            "ID": {"units": None, "col_type": "text", "references": "sample-type"}
        }

    def test_get_dataset_features(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):
        given_id = "matrix_given_id"
        dataset = factories.matrix_dataset(minimal_db, settings, given_id=given_id)
        response = client.get(
            f"/datasets/features/{dataset.id}", headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(response)
        dataset_features = response.json()
        feature_labels = [feature["label"] for feature in dataset_features]
        assert feature_labels == ["A", "B", "C"]

        # The same response should be returned when you pass in the given ID
        # instead of the dataset ID
        given_id_response = client.get(
            f"/datasets/features/{given_id}", headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(given_id_response)
        assert given_id_response.json() == response.json()

    def test_get_matrix_dataset_samples(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):
        given_id = "some_matrix_dataset"
        dataset = factories.matrix_dataset(minimal_db, settings, given_id=given_id)
        response = client.get(
            f"/datasets/samples/{dataset.id}", headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(response)
        dataset_samples = response.json()
        sample_labels = [sample["label"] for sample in dataset_samples]
        assert sample_labels == ["ACH-1", "ACH-2"]

        # The same response should be returned when you pass in the given ID
        # instead of the dataset ID
        given_id_response = client.get(
            f"/datasets/samples/{given_id}", headers={"X-Forwarded-User": "anyone"},
        )
        assert_status_ok(given_id_response)
        assert given_id_response.json() == response.json()

    def test_get_dimensions_with_reference_tiny_example(
        self, minimal_db, client: TestClient, settings, public_group
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}

        # Add a "gene" feature type with one row and two columns (label and entrez_id)
        referenced_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id"],
                "annotation_type_mapping": json.dumps(
                    {"annotation_type_mapping": {"label": "text", "entrez_id": "text",}}
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id"],
                        row_values=[["BRAF", "entrez_id_BRAF",]],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        assert_status_ok(referenced_feature_type_response)

        # At this point, there should only be 2 search index entries
        dimension_search_index_entries = minimal_db.query(DimensionSearchIndex).all()
        assert len(dimension_search_index_entries) == 2

        # Now add metadata that references gene
        feature_type_with_reference_response = client.post(
            "/types/feature",
            data={
                "name": "compound",
                "id_column": "compound_id",
                "properties_to_index": ["compound_id", "label", "target"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "compound_id": "text",
                            "target": "list_strings",
                        }
                    }
                ),
                "id_mapping": json.dumps(
                    {"id_mapping": {"reference_column_mappings": {"target": "gene"}}}
                ),
            },
            files={
                "metadata_file": (
                    "compound_metadata",
                    factories.tabular_csv_data_file(
                        cols=["compound_id", "label", "target"],
                        row_values=[
                            ["compound_id_az-628", "AZ-628", '["entrez_id_BRAF"]'],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        assert_status_ok(referenced_feature_type_response)

        # Now 4 more search index entries should have been added (compound_id, label, target.label, and target.entrez_id)
        dimension_search_index_entries = minimal_db.query(DimensionSearchIndex).all()
        assert len(dimension_search_index_entries) == 6

    def test_get_dimensions_with_multiple_substrs(
        self, minimal_db, client: TestClient, settings, public_group
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}

        # Step 1: We need a gene dimension type that has BRAF
        braf_gene_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id", "multi_val_example"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "entrez_id": "text",
                            "multi_val_example": "list_strings",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "multi_val_example"],
                        row_values=[
                            [
                                "BRAF",
                                "entrez_id_BRAF",
                                # Each of these values should add an independent entry into the search index
                                '["BRAF_val1", "BRAF_val2", "BRAF_val3"]',
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "BRAX",
                                "entrez_id_ABC1",
                            ],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        response = client.get(
            "/datasets/dimensions/?limit=100&type_name=gene&substring=BR&substring=ABC"
        )
        assert_status_ok(response)
        assert response.json() == [
            {
                "type_name": "gene",
                "id": "entrez_id_ABC1",
                "label": "BRAX",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "label", "value": "BRAX"},
                    {"property": "entrez_id", "value": "entrez_id_ABC1"},
                ],
            },
        ]

        response = client.get(
            "/datasets/dimensions/?limit=100&type_name=gene&prefix=BR&prefix=entrez_id_A"
        )
        assert_status_ok(response)
        assert response.json() == [
            {
                "type_name": "gene",
                "id": "entrez_id_ABC1",
                "label": "BRAX",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "label", "value": "BRAX"},
                    {"property": "entrez_id", "value": "entrez_id_ABC1"},
                ],
            },
        ]

    def test_get_dimensions_braf_example(
        self, minimal_db, client: TestClient, settings, public_group
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}

        # Step 1: We need a gene dimension type that has BRAF
        braf_gene_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id", "multi_val_example"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "entrez_id": "text",
                            "multi_val_example": "list_strings",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "multi_val_example"],
                        row_values=[
                            [
                                "BRAF",
                                "entrez_id_BRAF",
                                # Each of these values should add an independent entry into the search index
                                '["BRAF_val1", "BRAF_val2", "BRAF_val3"]',
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "BRUL",
                                "entrez_id_BRUL",
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "BRWL",
                                "entrez_id_BRWL",
                                '["BRWL_val1"]',
                            ],
                            [
                                # Gene without a matching prefix. Shouldn't show up when typing "BR"
                                "SOX10",
                                "entrez_id_SOX10",
                            ],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        # AZ-628, BELVARAFENIB, CEP-32496 <-- These all target BRAF
        # We want the UI to be able to use this endpoint to get results
        # like "AZ-628 targets BRAF" when the user types "BR"
        compound_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "compound",
                "id_column": "compound_id",
                "properties_to_index": ["compound_id", "label", "target"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "compound_id": "text",
                            "target": "list_strings",
                        }
                    }
                ),
                "id_mapping": json.dumps(
                    {"id_mapping": {"reference_column_mappings": {"target": "gene"}}}
                ),
            },
            files={
                "metadata_file": (
                    "compound_metadata",
                    factories.tabular_csv_data_file(
                        cols=["compound_id", "label", "target"],
                        row_values=[
                            ["compound_id_az-628", "AZ-628", '["entrez_id_BRAF"]'],
                            [
                                "compound_id_BELVARAFENIB",
                                "BELVARAFENIB",
                                '["entrez_id_BRAF", "entrez_id_SOX10"]',
                            ],
                            [
                                "compound_id_CEP-32496",
                                "CEP-32496",
                                '["entrez_id_BRAF"]',
                            ],
                            # Make sure this doesn't show up
                            [
                                "compound_id_RANDOM",
                                "Compound_does_not_target_braf",
                                '["entrez_id_SOX10"]',
                            ],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        assert_status_ok(braf_gene_feature_type_response)
        assert_status_ok(compound_feature_type_response)

        columns = minimal_db.query(TabularColumn).all()
        assert (
            len(
                [
                    column
                    for column in columns
                    if column.references_dimension_type_name is not None
                ]
            )
            == 1
        )

        dimension_search_index_entries = minimal_db.query(DimensionSearchIndex).all()

        assert len(dimension_search_index_entries) == 39

        # Make sure patching gene does not stomp out the compound features built from the id_mapping
        patch_should_not_break_index = client.patch(
            "/types/feature/gene/metadata",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id", "multi_val_example"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "entrez_id": "text",
                            "multi_val_example": "list_strings",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "multi_val_example"],
                        row_values=[
                            [
                                "BRAF",
                                "entrez_id_BRAF",
                                # Each of these values should add an independent entry into the search index
                                '["BRAF_val1", "BRAF_val2", "BRAF_val3"]',
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "BRUL",
                                "entrez_id_BRUL",
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "BRWL",
                                "entrez_id_BRWL",
                                '["BRWL_val1"]',
                            ],
                            [
                                # Gene without a matching prefix. Shouldn't show up when typing "BR"
                                "SOX10",
                                "entrez_id_SOX10",
                            ],
                            [
                                # Gene sharing first 2 letters prefix with BRAF to see
                                # behavior when we want to get dimensions using the "BR" prefix
                                "added",
                                "entrez_id_added",
                                '["added_val1"]',
                            ],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        dimensions_response = client.get(
            "/datasets/dimensions/?limit=100&type_name=compound"
        )

        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "compound",
                    "id": "compound_id_az-628",
                    "label": "AZ-628",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "compound_id", "value": "compound_id_az-628"},
                        {"property": "label", "value": "AZ-628"},
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.entrez_id", "value": "entrez_id_BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                    ],
                },
                {
                    "type_name": "compound",
                    "id": "compound_id_BELVARAFENIB",
                    "label": "BELVARAFENIB",
                    "referenced_by": None,
                    "matching_properties": [
                        {
                            "property": "compound_id",
                            "value": "compound_id_BELVARAFENIB",
                        },
                        {"property": "label", "value": "BELVARAFENIB"},
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.entrez_id", "value": "entrez_id_BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                        {"property": "target.label", "value": "SOX10"},
                        {"property": "target.entrez_id", "value": "entrez_id_SOX10"},
                    ],
                },
                {
                    "type_name": "compound",
                    "id": "compound_id_CEP-32496",
                    "label": "CEP-32496",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "compound_id", "value": "compound_id_CEP-32496"},
                        {"property": "label", "value": "CEP-32496"},
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.entrez_id", "value": "entrez_id_BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                    ],
                },
                {
                    "type_name": "compound",
                    "id": "compound_id_RANDOM",
                    "label": "Compound_does_not_target_braf",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "compound_id", "value": "compound_id_RANDOM"},
                        {"property": "label", "value": "Compound_does_not_target_braf"},
                        {"property": "target.label", "value": "SOX10"},
                        {"property": "target.entrez_id", "value": "entrez_id_SOX10"},
                    ],
                },
            ],
        )

        prefix_filtered_dimensions_response = client.get(
            "/datasets/dimensions/?limit=100&type_name=compound&prefix=br"
        )

        # Frontend needs to display:
        #       AZ-628 target: BRAF
        #       BELVARAFENIB target: BRAF
        #       CEP-32496 target: BRAF
        # The query looks for matches on BOTH DimensionSearchIndex.label
        # AND DimensionSearchIndex.value.
        assert_dimensions_response_matches(
            prefix_filtered_dimensions_response.json(),
            [
                {
                    "type_name": "compound",
                    "id": "compound_id_az-628",
                    "label": "AZ-628",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                    ],
                },
                {
                    "type_name": "compound",
                    "id": "compound_id_BELVARAFENIB",
                    "label": "BELVARAFENIB",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                    ],
                },
                {
                    "type_name": "compound",
                    "id": "compound_id_CEP-32496",
                    "label": "CEP-32496",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "target.label", "value": "BRAF"},
                        {"property": "target.multi_val_example", "value": "BRAF_val1"},
                        {"property": "target.multi_val_example", "value": "BRAF_val2"},
                        {"property": "target.multi_val_example", "value": "BRAF_val3"},
                    ],
                },
            ],
        )

    def test_get_dimensions_with_referenced_datasets(
        self, db, client, settings, private_group, minimal_db
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        gene_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "label",
                "properties_to_index": ["label", "name"],
                "annotation_type_mapping": json.dumps(
                    {"annotation_type_mapping": {"label": "text", "name": "text",}}
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "name"],
                        row_values=[["alpha", "name:alpha"], ["gamma", "name:gamma"],],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert gene_feature_type_response.status_code == 200

        # now create three datasets:
        # 1. a transient dataset (which should be filtered out)
        # 2. a private dataset (which should be filtered out)
        # 3. a public dataset (which should be visible in referenced_by)

        data_files = [
            factories.matrix_csv_data_file_with_values(
                feature_ids=["alpha"], sample_ids=["ACH-1"], values=[[1]],
            )
            for i in range(3)
        ]

        factories.matrix_dataset(
            db,
            settings,
            dataset_name="transient",
            feature_type="gene",
            is_transient=True,
            data_file=data_files[0],
        )
        factories.matrix_dataset(
            db,
            settings,
            dataset_name="private",
            feature_type="gene",
            group=private_group["id"],
            data_file=data_files[1],
        )
        visible_dataset = factories.matrix_dataset(
            db,
            settings,
            dataset_name="visible",
            feature_type="gene",
            data_file=data_files[2],
        )

        # include "%" to make sure escaping is working property. If it's not, it'd return both rows
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=100&prefix=name&include_referenced_by=T"
        )
        assert dimensions_response.status_code == 200
        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "gene",
                    "id": "alpha",
                    "label": "alpha",
                    "referenced_by": [
                        {"id": visible_dataset.id, "name": visible_dataset.name}
                    ],
                    "matching_properties": [
                        {"property": "name", "value": "name:alpha"},
                    ],
                },
                {
                    "type_name": "gene",
                    "id": "gamma",
                    "label": "gamma",
                    "referenced_by": [],
                    "matching_properties": [
                        {"property": "name", "value": "name:gamma"},
                    ],
                },
            ],
        )

    def test_get_dimensions_by_substr(self, client, settings, public_group, minimal_db):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}
        gene_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "label",
                "properties_to_index": ["label", "name"],
                "annotation_type_mapping": json.dumps(
                    {"annotation_type_mapping": {"label": "text", "name": "text",}}
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "name"],
                        row_values=[
                            ["alpha", "not-this-entry"],
                            ["gamma", "only-this%-entry"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert gene_feature_type_response.status_code == 200

        # include "%" to make sure escaping is working property. If it's not, it'd return both rows
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=100&substring=this%"
        )
        assert dimensions_response.status_code == 200
        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "gene",
                    "id": "gamma",
                    "label": "gamma",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "name", "value": "only-this%-entry"},
                    ],
                },
            ],
        )

    def test_get_dimensions(
        self, minimal_db, client: TestClient, settings, public_group
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        gene_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id"],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "entrez_id": "text",
                            "aliases": "list_strings",
                            "P2": "text",
                            "P3": "text",
                            "P4": "text",
                            "P5": "text",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "gene_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "aliases", "P2", "P3", "P4", "P5"],
                        row_values=[
                            [
                                "a",
                                "A",
                                '["test"]',
                                "p2_val_a",
                                "p3_val_a",
                                "p4_val_a",
                                "p5_val_a",
                            ],
                            [
                                "ab",
                                "AB",
                                '["p1_val_ab"]',
                                "p2_val_ab",
                                "p3_val_ab",
                                "p4_val_ab",
                                "p5_val_ab",
                            ],
                            [
                                "b",
                                "B",
                                '["p1_val_b"]',
                                "p2_val_b",
                                "p3_val_b",
                                "p4_val_b",
                                "p5_val_b",
                            ],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        compound_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "compound",
                "id_column": "compound_id",
                "properties_to_index": ["compound_id", "label", "aliases", "target",],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "label": "text",
                            "compound_id": "text",
                            "aliases": "list_strings",
                            "target": "text",
                        }
                    }
                ),
                "id_mapping": json.dumps(
                    {"id_mapping": {"reference_column_mappings": {"target": "gene"}}}
                ),
            },
            files={
                "metadata_file": (
                    "compound_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "compound_id", "aliases", "target"],
                        row_values=[
                            ["ab", "AB", '["ALIAS_1","ALIAS_2"]', "AB"],
                            ["b", "B", '["p1_val_b"]', "B"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        oncref_feature_type_response = client.post(
            "/types/feature",
            data={
                "name": "oncref_condition",
                "id_column": "condition_id",
                "properties_to_index": [
                    "condition_id",
                    "label",
                    "sample_id",
                    "compound_id",
                ],
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "condition_id": "text",
                            "label": "text",
                            "sample_id": "text",
                            "compound_id": "text",
                        }
                    }
                ),
                "id_mapping": json.dumps(
                    {
                        "id_mapping": {
                            "reference_column_mappings": {"compound_id": "compound"}
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "oncref_condition_metadata",
                    factories.tabular_csv_data_file(
                        cols=["condition_id", "label", "sample_id", "compound_id"],
                        row_values=[
                            ["ab", "AB", "p1_val_ab", "AB"],
                            ["b", "B", "p1_val_b", "B"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )

        for dimension_type_name in ["gene", "compound", "oncref_condition"]:
            dimension_type = get_dimension_type(minimal_db, dimension_type_name)
            assert dimension_type is not None
            populate_search_index_after_update(minimal_db, dimension_type)

        search_index_entries = []
        for item in minimal_db.query(DimensionSearchIndex).all():
            search_index_entries.append(
                {
                    "dimension_given_id": item.dimension_given_id,
                    "axis": "feature",
                    "label": item.label,
                    "property": item.property,
                    "value": item.value,
                }
            )

        expected_search_index_entries = [
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "condition_id",
                "value": "ab",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "label",
                "value": "AB",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "sample_id",
                "value": "p1_val_ab",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.compound_id",
                "value": "AB",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.label",
                "value": "ab",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.aliases",
                "value": "ALIAS_1",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.aliases",
                "value": "ALIAS_2",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.target.label",
                "value": "ab",
            },
            {
                "dimension_given_id": "ab",
                "axis": "feature",
                "label": "AB",
                "property": "compound_id.target.entrez_id",
                "value": "AB",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "condition_id",
                "value": "b",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "label",
                "value": "B",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "sample_id",
                "value": "p1_val_b",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "compound_id.compound_id",
                "value": "B",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "compound_id.label",
                "value": "b",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "compound_id.aliases",
                "value": "p1_val_b",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "compound_id.target.label",
                "value": "b",
            },
            {
                "dimension_given_id": "b",
                "axis": "feature",
                "label": "B",
                "property": "compound_id.target.entrez_id",
                "value": "B",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "compound_id",
                "value": "AB",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "label",
                "value": "ab",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "aliases",
                "value": "ALIAS_1",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "aliases",
                "value": "ALIAS_2",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "target.label",
                "value": "ab",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "target.entrez_id",
                "value": "AB",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "compound_id",
                "value": "B",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "label",
                "value": "b",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "aliases",
                "value": "p1_val_b",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "target.label",
                "value": "b",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "target.entrez_id",
                "value": "B",
            },
            {
                "dimension_given_id": "A",
                "axis": "feature",
                "label": "a",
                "property": "label",
                "value": "a",
            },
            {
                "dimension_given_id": "A",
                "axis": "feature",
                "label": "a",
                "property": "entrez_id",
                "value": "A",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "label",
                "value": "ab",
            },
            {
                "dimension_given_id": "AB",
                "axis": "feature",
                "label": "ab",
                "property": "entrez_id",
                "value": "AB",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "label",
                "value": "b",
            },
            {
                "dimension_given_id": "B",
                "axis": "feature",
                "label": "b",
                "property": "entrez_id",
                "value": "B",
            },
        ]

        def sort_entries(entries):
            return sorted(
                entries,
                key=lambda x: (x["dimension_given_id"], x["property"], x["label"]),
            )

        assert sort_entries(search_index_entries) == sort_entries(
            expected_search_index_entries
        )

        dimensions_response = client.get("/datasets/dimensions/?limit=100")

        # Leave limit at 100 to return everything. Should be ordered by label, then by type_name and id.
        expected_response = [
            {
                "type_name": "oncref_condition",
                "id": "ab",
                "label": "AB",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "condition_id", "value": "ab"},
                    {"property": "label", "value": "AB"},
                    {"property": "sample_id", "value": "p1_val_ab"},
                    {"property": "compound_id.compound_id", "value": "AB"},
                    {"property": "compound_id.label", "value": "ab"},
                    {"property": "compound_id.aliases", "value": "ALIAS_1"},
                    {"property": "compound_id.aliases", "value": "ALIAS_2"},
                    {"property": "compound_id.target.label", "value": "ab"},
                    {"property": "compound_id.target.entrez_id", "value": "AB"},
                ],
            },
            {
                "type_name": "oncref_condition",
                "id": "b",
                "label": "B",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "condition_id", "value": "b"},
                    {"property": "label", "value": "B"},
                    {"property": "sample_id", "value": "p1_val_b"},
                    {"property": "compound_id.compound_id", "value": "B"},
                    {"property": "compound_id.label", "value": "b"},
                    {"property": "compound_id.aliases", "value": "p1_val_b"},
                    {"property": "compound_id.target.label", "value": "b"},
                    {"property": "compound_id.target.entrez_id", "value": "B"},
                ],
            },
            {
                "type_name": "gene",
                "id": "A",
                "label": "a",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "label", "value": "a"},
                    {"property": "entrez_id", "value": "A"},
                ],
            },
            {
                "type_name": "compound",
                "id": "AB",
                "label": "ab",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "compound_id", "value": "AB"},
                    {"property": "label", "value": "ab"},
                    {"property": "aliases", "value": "ALIAS_1"},
                    {"property": "aliases", "value": "ALIAS_2"},
                    {"property": "target.label", "value": "ab"},
                    {"property": "target.entrez_id", "value": "AB"},
                ],
            },
            {
                "type_name": "gene",
                "id": "AB",
                "label": "ab",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "label", "value": "ab"},
                    {"property": "entrez_id", "value": "AB"},
                ],
            },
            {
                "type_name": "compound",
                "id": "B",
                "label": "b",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "compound_id", "value": "B"},
                    {"property": "label", "value": "b"},
                    {"property": "aliases", "value": "p1_val_b"},
                    {"property": "target.label", "value": "b"},
                    {"property": "target.entrez_id", "value": "B"},
                ],
            },
            {
                "type_name": "gene",
                "id": "B",
                "label": "b",
                "referenced_by": None,
                "matching_properties": [
                    {"property": "label", "value": "b"},
                    {"property": "entrez_id", "value": "B"},
                ],
            },
        ]

        assert dimensions_response.json() == expected_response

        # Filter on type_name
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=100&type_name=gene"
        )
        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "gene",
                    "id": "A",
                    "label": "a",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "label", "value": "a"},
                        {"property": "entrez_id", "value": "A"},
                    ],
                },
                {
                    "type_name": "gene",
                    "id": "AB",
                    "label": "ab",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "label", "value": "ab"},
                        {"property": "entrez_id", "value": "AB"},
                    ],
                },
                {
                    "type_name": "gene",
                    "id": "B",
                    "label": "b",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "label", "value": "b"},
                        {"property": "entrez_id", "value": "B"},
                    ],
                },
            ],
        )

        # Lower limit
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=4&type_name=compound&prefix=ab"
        )
        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "compound",
                    "id": "AB",
                    "label": "ab",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "compound_id", "value": "AB"},
                        {"property": "label", "value": "ab"},
                        {"property": "target.label", "value": "ab"},
                        {"property": "target.entrez_id", "value": "AB"},
                    ],
                }
            ],
        )

        # Filter on prefix
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=10&type_name=gene&prefix=b"
        )
        assert_dimensions_response_matches(
            dimensions_response.json(),
            [
                {
                    "type_name": "gene",
                    "id": "B",
                    "label": "b",
                    "referenced_by": None,
                    "matching_properties": [
                        {"property": "label", "value": "b"},
                        {"property": "entrez_id", "value": "B"},
                    ],
                }
            ],
        )

        # There is no does_not_exist type_name, so this shouldn't return any results
        dimensions_response = client.get(
            "/datasets/dimensions/?limit=1&prefix=ab&type_name=does_not_exist"
        )
        assert dimensions_response.json() == []


class TestPatch:
    def test_update_dataset(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        settings: Settings,
        private_group: Dict,
    ):
        # Create a new matrix dataset
        test_user_headers = {"X-Forwarded-User": "someone@private-group.com"}
        matrix_file_ids, matrix_hash = upload_and_get_file_ids(
            client, factories.continuous_matrix_csv_file()
        )
        matrix_dataset_res = client.post(
            "/dataset-v2/",
            json={
                "format": "matrix",
                "file_ids": matrix_file_ids,
                "dataset_md5": matrix_hash,
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "dataset_metadata": {"test": "value", "another": "value"},
            },
            headers=test_user_headers,
        )

        assert_status_ok(matrix_dataset_res)
        dataset_res = matrix_dataset_res.json()
        dataset_id = dataset_res["result"]["dataset"]["id"]

        assert dataset_res["result"]["dataset"]["dataset_metadata"] == {
            "test": "value",
            "another": "value",
        }

        # create a new group
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        new_group_response = client.post(
            "/groups/", json={"name": "TestAdd"}, headers=admin_headers
        )
        assert_status_ok(new_group_response)
        group_id = new_group_response.json()["id"]

        # Check that you can't update a dataset without valid credentials
        bad_user_update_dataset = client.patch(
            f"/datasets/{dataset_id}",
            json={"name": "New Name"},
            headers={"X-Forwarded-User": "someone"},
        )
        assert bad_user_update_dataset.status_code == 404

        # Check that a well-formed request returns a happy result
        new_name = "UPDATED NAME"
        new_units = "UPDATED UNITS"
        new_version = "updated version"
        new_short_name = "updated short name"
        new_description = "updated description"
        update_dataset_response = client.patch(
            f"/datasets/{dataset_id}",
            json={
                "format": "matrix",
                "group_id": group_id,
                "name": new_name,
                "units": new_units,
                "priority": "1",
                "dataset_metadata": None,
                "short_name": new_short_name,
                "version": new_version,
                "description": new_description,
            },
            headers=admin_headers,
        )
        assert_status_ok(update_dataset_response)
        assert update_dataset_response.json()["dataset_metadata"] == None
        assert update_dataset_response.json()["group"]["id"] == group_id
        assert update_dataset_response.json()["name"] == new_name
        assert update_dataset_response.json()["units"] == new_units
        assert update_dataset_response.json()["priority"] == 1
        assert update_dataset_response.json()["short_name"] == new_short_name
        assert update_dataset_response.json()["version"] == new_version
        assert update_dataset_response.json()["description"] == new_description
        assert (
            update_dataset_response.json()["data_type"] == "User upload"
        )  # same value expected
        dataset = minimal_db.query(Dataset).filter(Dataset.id == dataset_id).one()
        assert dataset.update_date is not None

        # Check that the updates are saved to the database
        dataset_response_after_update = client.get(
            f"/datasets/{dataset_id}", headers=admin_headers
        )
        assert_status_ok(dataset_response_after_update)
        assert dataset_response_after_update.json()["dataset_metadata"] == None
        assert dataset_response_after_update.json()["group"]["id"] == group_id
        assert dataset_response_after_update.json()["name"] == new_name
        assert dataset_response_after_update.json()["units"] == new_units
        assert dataset_response_after_update.json()["priority"] == 1
        assert dataset_response_after_update.json()["short_name"] == new_short_name
        assert dataset_response_after_update.json()["version"] == new_version
        assert dataset_response_after_update.json()["description"] == new_description
        assert (
            dataset_response_after_update.json()["data_type"] == "User upload"
        )  # same value expected

        # Check that we can set the given_id to a non-null value and then reset it back to null
        update_dataset_response = client.patch(
            f"/datasets/{dataset_id}",
            json={"format": "matrix", "given_id": "xyz"},
            headers=admin_headers,
        )
        assert_status_ok(update_dataset_response)

        dataset_response_after_update = client.get(
            f"/datasets/{dataset_id}", headers=admin_headers
        )
        assert_status_ok(dataset_response_after_update)
        assert dataset_response_after_update.json()["given_id"] == "xyz"

        update_dataset_response = client.patch(
            f"/datasets/{dataset_id}",
            json={"format": "matrix", "given_id": None},
            headers=admin_headers,
        )
        assert_status_ok(update_dataset_response)

        dataset_response_after_update = client.get(
            f"/datasets/{dataset_id}", headers=admin_headers
        )
        assert_status_ok(dataset_response_after_update)
        assert dataset_response_after_update.json()["given_id"] is None

        # Check that the original dataset owner can no longer access it (because the group was changed)
        dataset_response_after_update = client.get(
            f"/datasets/{dataset_id}", headers=test_user_headers
        )
        assert dataset_response_after_update.status_code == 404

        # Test tabular dataset
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1"],
            row_values=[["ACH-1", 1.0,], ["ACH-3", np.NaN],],
        )
        tabular_file_ids, tabular_hash = upload_and_get_file_ids(
            client, tabular_data_file
        )
        tabular_dataset_res = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": tabular_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "depmap_id": {"units": None, "col_type": "text",},
                    "attr1": {"units": "some units", "col_type": "continuous"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_res)
        res = tabular_dataset_res.json()
        tab_dataset_id = res["result"]["dataset"]["id"]

        no_update_response = client.patch(
            f"/datasets/{tab_dataset_id}",
            json={"format": "tabular"},
            headers=admin_headers,
        )
        assert_status_ok(no_update_response)
        assert no_update_response.json()["dataset_metadata"] == {"yah": "nah"}
        assert no_update_response.json()["group"]["id"] == private_group["id"]
        assert no_update_response.json()["name"] == "a table dataset"
        assert no_update_response.json()["priority"] == None  # no change expected
        assert (
            no_update_response.json()["data_type"] == "User upload"
        )  # same value expected

        update_tab_dataset_response = client.patch(
            f"/datasets/{tab_dataset_id}",
            json={
                "format": "tabular",
                "group_id": group_id,
                "name": new_name,
                "dataset_metadata": None,
            },
            headers=admin_headers,
        )
        assert_status_ok(update_tab_dataset_response)
        assert update_tab_dataset_response.json()["dataset_metadata"] == None
        assert update_tab_dataset_response.json()["group"]["id"] == group_id
        assert update_tab_dataset_response.json()["name"] == new_name
        assert (
            update_tab_dataset_response.json()["priority"] == None
        )  # no change expected
        assert (
            update_tab_dataset_response.json()["data_type"] == "User upload"
        )  # same value expected
        dataset = minimal_db.query(Dataset).filter(Dataset.id == tab_dataset_id).one()
        assert dataset.update_date is not None
        # Check that the updates are saved to the database
        dataset_response_after_update = client.get(
            f"/datasets/{tab_dataset_id}", headers=admin_headers
        )
        assert_status_ok(dataset_response_after_update)
        assert dataset_response_after_update.json()["dataset_metadata"] == None
        assert dataset_response_after_update.json()["group"]["id"] == group_id
        assert dataset_response_after_update.json()["name"] == new_name

        # Check that the original dataset owner can no longer access it (because the group was changed)
        dataset_response_after_update = client.get(
            f"/datasets/{tab_dataset_id}", headers=test_user_headers
        )
        assert dataset_response_after_update.status_code == 404

    def test_update_dataset_bad_params(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        settings: Settings,
        private_group: Dict,
    ):
        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        tabular_data_file = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1"],
            row_values=[["ACH-1", 1.0,], ["ACH-3", np.NaN],],
        )
        tabular_file_ids, tabular_hash = upload_and_get_file_ids(
            client, tabular_data_file
        )
        tabular_dataset_res = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "a table dataset",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids,
                "dataset_md5": tabular_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": {"yah": "nah"},
                "columns_metadata": {
                    "depmap_id": {"units": None, "col_type": "text",},
                    "attr1": {"units": "some units", "col_type": "continuous"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_res)
        res = tabular_dataset_res.json()
        dataset_id = res["result"]["dataset"]["id"]

        update_tab_dataset_response = client.patch(
            f"/datasets/{dataset_id}",
            json={
                "format": "matrix",  # incorrect format
                "name": "UPDATED NAME",
                "units": "UPDATED UNITS",  # Not a valid param for tabular dataset
                "dataset_metadata": None,
            },
            headers=admin_headers,
        )
        assert_status_not_ok(update_tab_dataset_response)
        assert update_tab_dataset_response.status_code == 400


class TestDelete:
    def test_delete(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        tmpdir,
        private_group,
        settings,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}

        dataset_in_private_group_id = factories.matrix_dataset(
            minimal_db, settings, group=private_group["id"]
        ).id

        # make sure it's there
        r = client.get(f"/datasets/{dataset_in_private_group_id}", headers=headers)
        assert_status_ok(r)
        datasets = (
            minimal_db.query(MatrixDataset)
            .filter_by(id=dataset_in_private_group_id)
            .all()
        )
        dataset_ids = [dataset.id for dataset in datasets]
        dataset_feature_indexes = (
            minimal_db.query(DatasetFeature)
            .filter_by(dataset_id=dataset_in_private_group_id)
            .all()
        )
        feature_index_ids = [f.id for f in dataset_feature_indexes]
        dataset_sample_indexes = (
            minimal_db.query(DatasetSample)
            .filter_by(dataset_id=dataset_in_private_group_id)
            .all()
        )
        sample_index_ids = [s.id for s in dataset_sample_indexes]
        assert len(datasets) != 0
        assert len(dataset_sample_indexes) != 0
        assert len(dataset_feature_indexes) != 0

        # and now delete it
        r = client.delete(f"/datasets/{dataset_in_private_group_id}", headers=headers)
        assert_status_ok(r)

        # and now it's gone
        r = client.get(f"/datasets/{dataset_in_private_group_id}", headers=headers)
        assert_status_not_ok(r)
        assert r.status_code == 404
        datasets = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id.in_(dataset_ids))
            .all()
        )
        dataset_feature_indexes = (
            minimal_db.query(DatasetFeature)
            .filter(DatasetFeature.id.in_(feature_index_ids))
            .all()
        )
        dataset_sample_indexes = (
            minimal_db.query(DatasetSample)
            .filter(DatasetSample.id.in_(sample_index_ids))
            .all()
        )
        assert len(datasets) == 0
        assert len(dataset_sample_indexes) == 0
        assert len(dataset_feature_indexes) == 0
        assert not os.path.exists(
            os.path.join(settings.filestore_location, dataset_in_private_group_id)
        )

    def test_delete_no_permissions(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):
        user = "anyone"
        headers = {"X-Forwarded-User": user}

        dataset_in_public_group_id = factories.matrix_dataset(minimal_db, settings).id

        # make sure it's there
        r = client.get(f"/datasets/{dataset_in_public_group_id}", headers=headers)
        assert_status_ok(r)

        r = client.delete(f"/datasets/{dataset_in_public_group_id}", headers=headers)
        assert_status_not_ok(r)
        assert r.status_code == 403

        # make sure it's still there
        r = client.get(f"/datasets/{dataset_in_public_group_id}", headers=headers)
        assert_status_ok(r)
        dataset_feature_indexes = (
            minimal_db.query(DatasetFeature)
            .filter_by(dataset_id=dataset_in_public_group_id)
            .all()
        )
        dataset_sample_indexes = (
            minimal_db.query(DatasetSample)
            .filter_by(dataset_id=dataset_in_public_group_id)
            .all()
        )
        assert len(dataset_sample_indexes) != 0
        assert len(dataset_feature_indexes) != 0

    def test_delete_sample_type_and_feature_type(
        self, client: TestClient, minimal_db: SessionWithUser, settings
    ):

        orig_dataset_count = minimal_db.query(Dataset).count()
        orig_tabular_column_count = minimal_db.query(TabularColumn).count()
        orig_tabular_cell_count = minimal_db.query(TabularCell).count()
        orig_property_to_index_count = minimal_db.query(PropertyToIndex).count()
        orig_dimension_search_index_count = minimal_db.query(
            DimensionSearchIndex
        ).count()

        admin_user = settings.admin_users[0]
        admin_headers = {"X-Forwarded-Email": admin_user}
        r_feature_metadata = client.post(
            "/types/feature",
            data={
                "name": "gene",
                "id_column": "entrez_id",
                "properties_to_index": ["label", "entrez_id"],
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
                    "feature_metadata.csv",
                    factories.tabular_csv_data_file(
                        cols=["label", "entrez_id", "attr2"],
                        row_values=[["a", "A", 1.0], ["b", "B", 2.0]],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert r_feature_metadata.status_code == 200, r_feature_metadata.content
        feature_metadata_dataset_id = r_feature_metadata.json()["dataset"]["id"]
        feature_annotations = (
            minimal_db.query(TabularColumn)
            .filter_by(dataset_id=feature_metadata_dataset_id)
            .all()
        )
        assert len(feature_annotations) == 3
        feature_annotation_values = minimal_db.query(TabularCell).all()
        dimension_search_index_values = minimal_db.query(DimensionSearchIndex).all()
        properties_to_index = minimal_db.query(PropertyToIndex).all()

        assert len(feature_annotation_values) > 0

        # Length should be 4, because per properties_to_index, we're
        # only indexing 2 of the 3 possible columns to index.
        assert len(properties_to_index) == 2
        assert len(dimension_search_index_values) == 4

        # Should not be able to delete metadata without first deleting feature type
        r_delete_feature_metadata = client.delete(
            f"/datasets/{feature_metadata_dataset_id}", headers=admin_headers
        )
        assert r_delete_feature_metadata.status_code == 400
        # Should delete all annotations in db
        r_delete_feature_type = client.delete(
            f"/types/feature/gene", headers=admin_headers
        )
        assert_status_ok(r_delete_feature_type)
        assert len(minimal_db.query(Dataset).all()) == orig_dataset_count
        assert len(minimal_db.query(TabularColumn).all()) == orig_tabular_column_count
        assert len(minimal_db.query(TabularCell).all()) == orig_tabular_cell_count
        assert (
            len(minimal_db.query(PropertyToIndex).all()) == orig_property_to_index_count
        )
        assert (
            len(minimal_db.query(DimensionSearchIndex).all())
            == orig_dimension_search_index_count
        )


def test_get_feature_data(minimal_db, settings, client: TestClient):
    # Mock data
    matrix_values = factories.matrix_csv_data_file_with_values(
        feature_ids=["featureID1", "featureID2", "featureID3"],
        sample_ids=["sampleID1", "sampleID2", "sampleID3"],
        values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    )
    dataset_given_id = "dataset123"
    dataset = factories.matrix_dataset(
        minimal_db, settings, data_file=matrix_values, given_id=dataset_given_id
    )

    # Base case: No features in request
    response = client.get(
        "/datasets/features/data/", headers={"X-Forwarded-User": "anyone"},
    )
    assert_status_ok(response)
    assert response.json() == []

    # Single feature requested
    response = client.get(
        f"/datasets/features/data/?dataset_ids={dataset.id}&feature_ids=featureID1",
        headers={"X-Forwarded-User": "anyone"},
    )
    assert_status_ok(response)
    response_content = response.json()
    assert len(response_content) == 1
    assert response_content[0] == {
        "feature_id": "featureID1",
        "dataset_id": dataset.id,
        "values": {"sampleID1": 1.0, "sampleID2": 4.0, "sampleID3": 7.0,},
        "label": "featureID1",
        "units": dataset.units,
        "dataset_label": dataset.name,
    }

    # Two features in request, specified with dataset given ID
    query_str = f"?dataset_ids={dataset_given_id}&dataset_ids={dataset_given_id}&feature_ids=featureID1&feature_ids=featureID3"
    response = client.get(
        f"/datasets/features/data/{query_str}", headers={"X-Forwarded-User": "anyone"},
    )
    assert_status_ok(response)
    response_content = response.json()
    assert len(response_content) == 2
    assert response_content[0] == {
        "feature_id": "featureID1",
        "dataset_id": dataset.id,
        "values": {"sampleID1": 1.0, "sampleID2": 4.0, "sampleID3": 7.0,},
        "label": "featureID1",
        "units": dataset.units,
        "dataset_label": dataset.name,
    }
    assert response_content[1] == {
        "feature_id": "featureID3",
        "dataset_id": dataset.id,
        "values": {"sampleID1": 3.0, "sampleID2": 6.0, "sampleID3": 9.0,},
        "label": "featureID3",
        "units": dataset.units,
        "dataset_label": dataset.name,
    }
