import os
import json
import uuid
import numpy as np
import pandas as pd
from ..utils import assert_status_not_ok, assert_status_ok, assert_task_failure

from sqlalchemy import and_

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
from breadbox.models.dataset import DimensionSearchIndex, DatasetReference
from breadbox.crud.dataset import get_datasets, populate_search_index

from breadbox.models.dataset import PropertyToIndex
from breadbox.schemas.dataset import ColumnMetadata

from tests import factories
from breadbox.config import Settings
from typing import Dict


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
            id_mapping={"ID": "sample-type"},
            columns_metadata={"ID": ColumnMetadata(col_type=AnnotationType.text)},
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

        dataset_references = minimal_db.query(DatasetReference).all()
        assert len(dataset_references) == 1

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

        datasets = get_datasets(minimal_db, admin_user, None, None, None, None, None)

        for dataset in datasets:
            populate_search_index(minimal_db, admin_user, dataset.id)

        search_index_entries = []
        for item in minimal_db.query(DimensionSearchIndex).all():
            search_index_entries.append(
                {
                    "dimension_given_id": item.dimension_given_id,
                    "axis": item.axis,
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
        assert search_index_entries == expected_search_index_entries

        dimensions_response = client.get("/datasets/dimensions/?limit=100")

        # Leave limit at 100 to return everything. Should be ordered by priority and then label.
        assert dimensions_response.json() == [
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


class TestPost:
    def test_add_dataset(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
    ):
        user = "someone@private-group.com"
        headers = {"X-Forwarded-User": user}
        group_id = private_group["id"]

        response = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": group_id,
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )

        assert_status_ok(response)
        dataset_id = response.json()["result"]["datasetId"]
        dataset = minimal_db.query(Dataset).filter(Dataset.id == dataset_id).one()
        assert dataset.upload_date is not None
        # Test that feature and sample dimensions were added
        feature_indexes = minimal_db.query(DatasetFeature).all()
        sample_indexes = minimal_db.query(DatasetSample).all()
        assert len(feature_indexes) == 3  # Number of feaures should be 3
        assert len(sample_indexes) == 2  # Number of feaures should be 2

    def test_add_dataset_no_write_access(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        public_group,
        settings,
    ):
        factories.feature_type(minimal_db, settings.default_user, "other_feature")
        factories.sample_type(minimal_db, settings.default_user, "other_sample")

        r = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "other_feature",
                "sample_type": "other_sample",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": public_group.id,
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "anyone"},
        )

        assert_task_failure(r, status_code=403)

    def test_add_dataset_nonexistent_group(
        self, client: TestClient, minimal_db, mock_celery, settings
    ):
        fake_group_id = str(uuid.uuid4())
        factories.feature_type(minimal_db, settings.default_user, "other_feature")
        factories.sample_type(minimal_db, settings.default_user, "other_sample")

        r = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "other_feature",
                "sample_type": "other_sample",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": fake_group_id,
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "anyone"},
        )

        assert_task_failure(r, status_code=404)

    def test_add_categorical_dataset(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
    ):
        user = "someone@private-group.com"
        r = client.post(
            "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing3",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r)
        assert r.status_code == 200
        result_dataset = r.json()["result"]["dataset"]
        feature_indexes = minimal_db.query(DatasetFeature).all()
        sample_indexes = minimal_db.query(DatasetSample).all()
        assert len(feature_indexes) == 3  # Number of feaures should be 3
        assert len(sample_indexes) == 2  # Number of samples should be 2
        categorical_dataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result_dataset["id"])
            .one()
        )
        assert categorical_dataset
        assert categorical_dataset.value_type == ValueType.categorical

    def test_add_categorical_and_binary_dataset(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
    ):
        user = "someone@private-group.com"
        # Two non boolean values should be considered categorical not binary
        r1 = client.post(
            "/datasets/?allowed_values=True&allowed_values=False",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values([True, False]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r1)
        assert r1.status_code == 200
        dataset_response = r1.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == dataset_response["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

        # Two non boolean values should be considered categorical not binary
        r = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )

        assert_status_ok(r)
        assert r.status_code == 200
        result_dataset = r.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result_dataset["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

        # Dataset only has two values but allowed values is more than 2
        r2 = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye&allowed_values=Unknown",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert_status_ok(r2) and r2.status_code == 200
        result2_dataset = r2.json()["result"]["dataset"]
        dataset: MatrixDataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.id == result2_dataset["id"])
            .one()
        )
        assert dataset is not None
        assert dataset.value_type == ValueType.categorical

    def test_add_categorical_incorrect_value_type(
        self, client: TestClient, private_group: Dict, mock_celery
    ):
        # Incorrect value type for categorical values
        r = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert_task_failure(r, status_code=500)

        # Value type cannot be None
        r = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert r.status_code == 422

        # Allowed values not given for categorical datasets
        r = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(["Hi", "Bye"]),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert_task_failure(r)

        incorrect_values_dataset = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(
                        ["Hi", "bi"]
                    ),  # Not in allowed values
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        incorrect_values_dataset_response = incorrect_values_dataset.json()
        # NOTE: Celery task returning 200 for job completion but state should be failed
        assert incorrect_values_dataset.status_code == 200
        assert incorrect_values_dataset_response["state"] == "FAILURE"

        mixed_case_dataset = client.post(
            "/datasets/?allowed_values=Hi&allowed_values=Bye",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(
                        ["Hi", "bye"]
                    ),  # Not in allowed values
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert_status_ok(mixed_case_dataset)

    def test_add_categorical_dataset_repeated_allowed_values(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery
    ):
        r = client.post(
            "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing1&allowed_values=Thing3",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )

        assert_status_ok(r)
        assert r.status_code == 200
        result = r.json()
        dataset_id = result["result"]["datasetId"]
        added_dataset = get_dataset(dataset_id, minimal_db, "someone@private-group.com")
        assert len(added_dataset.allowed_values) == 3 and set(
            added_dataset.allowed_values
        ) == {"Thing1", "Thing2", "Thing3",}

    def test_add_dataset_with_missing_values(
        self, client: TestClient, minimal_db, private_group: Dict, mock_celery, settings
    ):
        user = "someone@private-group.com"
        r_continuous = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(
                        values=[1, 2, 3, np.NaN]
                    ),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )

        assert_status_ok(r_continuous)
        assert r_continuous.status_code == 200
        result_dataset = r_continuous.json()["result"]["dataset"]

        assert minimal_db.query(Dataset).filter_by(id=result_dataset["id"]).one()
        assert (
            len(
                minimal_db.query(Dimension)
                .filter_by(dataset_id=result_dataset["id"])
                .all()
            )
            == 5
        )  # 3 features + 2 samples

        r_categorical = client.post(
            "/datasets/?allowed_values=Thing1&allowed_values=Thing2&allowed_values=Thing3",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "categorical",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.matrix_csv_data_file_with_values(
                        values=["Thing1", "Thing2", "Thing3", np.NaN]
                    ),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )

        assert_status_ok(r_categorical)
        assert r_categorical.status_code == 200
        result_dataset = r_categorical.json()["result"]["dataset"]

        assert minimal_db.query(Dataset).filter_by(id=result_dataset["id"]).one()
        assert (
            len(
                minimal_db.query(Dimension)
                .filter_by(dataset_id=result_dataset["id"])
                .all()
            )
            == 5
        )  # 3 features + 2 samples
        categorical_dataset = (
            minimal_db.query(MatrixDataset)
            .filter(MatrixDataset.value_type == ValueType.categorical)
            .one()
        )
        feature_indices = [
            tup[0]
            for tup in minimal_db.query(DatasetFeature.index)
            .filter(DatasetFeature.dataset_id == categorical_dataset.id)
            .order_by(DatasetFeature.index)
            .all()
        ]
        df = get_slice(
            categorical_dataset, feature_indices, None, settings.filestore_location
        )
        assert df.loc["ACH-2"]["A"] == None

    def test_add_dataset_if_valid_metadata_mappings(
        self,
        client: TestClient,
        minimal_db,
        private_group: Dict,
        settings,
        mock_celery,
    ):
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        r_feature_metadata = client.post(
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
                "taiga_id": "test-taiga.1",
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
        r_sample_metadata = client.post(
            "/types/sample",
            data={
                "name": "sample",
                "id_column": "sample_id",
                "annotation_type_mapping": json.dumps(
                    {
                        "annotation_type_mapping": {
                            "attr1": "text",
                            "attr2": "continuous",
                            "sample_id": "text",
                            "label": "text",
                        }
                    }
                ),
            },
            files={
                "metadata_file": (
                    "sample_metadata.csv",
                    factories.tabular_csv_data_file(
                        cols=["attr1", "sample_id", "attr2", "label"],
                        row_values=[
                            ["a", "ACH-1", 1.0, "cell line 1"],
                            ["b", "ACH-2", 2.0, "cell line 2"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert r_sample_metadata.status_code == 200, r_sample_metadata.content
        # If no metadata given, validate against feature type and sample type metadata. If not found, provide warning
        r_dataset_no_metadata_for_feature = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "gene",  # Metadata doesn't have feature 'C'
                "sample_type": "sample",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                )
            },  # Features: 'A', 'B', 'C'
            headers=admin_headers,
        )
        # Has warning
        assert_status_ok(r_dataset_no_metadata_for_feature), (
            r_dataset_no_metadata_for_feature.status_code == 200
        )
        assert r_dataset_no_metadata_for_feature.json()["result"]["warnings"] == [
            "Features: ['C'] not in gene metadata. Consider updating your feature type metadata!"
        ]

    def test_add_dataset_with_metadata(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
    ):
        headers = {"X-Forwarded-User": "someone@private-group.com"}

        dataset_simple_metadata = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "dataset_metadata": json.dumps(
                    {"dataset_metadata": {"test": "value", "another": "value"}}
                ),
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )

        assert_status_ok(dataset_simple_metadata)

        assert dataset_simple_metadata.json()["result"]["dataset"][
            "dataset_metadata"
        ] == {"test": "value", "another": "value",}

        dataset_nested_metadata = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "User upload",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "dataset_metadata": json.dumps(
                    {
                        "dataset_metadata": {
                            "test": "value",
                            "another": {"nested": "value"},
                        }
                    }
                ),
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers=headers,
        )
        assert_status_ok(dataset_nested_metadata)
        assert dataset_nested_metadata.json()["result"]["dataset"][
            "dataset_metadata"
        ] == {"test": "value", "another": {"nested": "value"}}

    def test_add_data_type_priority_datasets(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        settings: Settings,
        mock_celery,
        private_group: Dict,
    ):
        """
        priority does not need to be unique for each data type
        """
        factories.data_type(minimal_db, "test1")
        factories.data_type(minimal_db, "test2")
        test1_dataset = factories.matrix_dataset(
            minimal_db, settings, data_type="test1", priority=1
        )
        test2_dataset = factories.matrix_dataset(
            minimal_db, settings, data_type="test2", priority=1
        )

        user = "someone@private-group.com"
        r1 = client.post(
            "/datasets/",
            data={
                "name": "a dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "test2",
                "is_transient": "False",
                "group_id": private_group["id"],
                "value_type": "continuous",
                "priority": "2",
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": user},
        )
        assert minimal_db.query(Dataset).filter_by(name="a dataset").one()

        # with pytest.raises(Exception):
        r2 = client.post(
            "/datasets/",
            data={  # pyright: ignore
                "name": "another dataset",
                "units": "a unit",
                "feature_type": "generic",
                "sample_type": "depmap_model",
                "data_type": "test2",
                "is_transient": False,
                "group_id": private_group["id"],
                "value_type": "continuous",
                "priority": 2,
            },
            files={
                "data_file": (
                    "data.csv",
                    factories.continuous_matrix_csv_file(),
                    "text/csv",
                ),
            },
            headers={"X-Forwarded-User": "someone@private-group.com"},
        )
        assert r2.status_code == 200

    def test_get_matrix_dataset_data_by_given_id(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        given_id = "dataset_given_id"
        factories.matrix_dataset(minimal_db, settings, given_id=given_id)
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(f"/datasets/data/{given_id}",)
        assert_status_ok(response)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }
        response = client.post(f"/datasets/matrix/{given_id}",)
        assert_status_ok(response)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }

    def test_get_matrix_dataset_data_no_filters(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        dataset = factories.matrix_dataset(minimal_db, settings)
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(f"/datasets/data/{dataset.id}",)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }
        response = client.post(f"/datasets/matrix/{dataset.id}",)
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
            "C": {"ACH-1": 2.0, "ACH-2": 5.0},
        }

    def test_get_matrix_dataset_data_generic_feature_type_labels(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        dataset = factories.matrix_dataset(minimal_db, settings, feature_type=None)
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "label",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "label",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }

        # verify that when we fetch a feature which doesn't exist, we silently drop the invalid feature
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

    def test_get_matrix_dataset_data_by_ids(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        dataset = factories.matrix_dataset(minimal_db, settings)
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }

        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "B"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "ACH-2"],
                "sample_identifier": "id",
            },
        )
        assert response.json() == {
            "A": {"ACH-1": 0.0, "ACH-2": 3.0},
            "B": {"ACH-1": 1.0, "ACH-2": 4.0},
        }
        # verify that when we fetch a feature which doesn't exist, we silently drop the invalid feature
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

        # verify if strict keyword provided, when we fetch a feature that doesn't exist, we raise an error
        response = client.post(
            f"/datasets/matrix/{dataset.id}?strict=True",
            json={
                "features": ["A", "INVALID"],
                "feature_identifier": "id",
                "samples": ["ACH-1"],
                "sample_identifier": "id",
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"]

        # same for a missing sample
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{dataset.id}",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }
        response = client.post(
            f"/datasets/matrix/{dataset.id}",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "A": {"ACH-1": 0.0},
        }

        response = client.post(
            f"/datasets/matrix/{dataset.id}?strict=True",
            json={
                "features": ["A"],
                "feature_identifier": "id",
                "samples": ["ACH-1", "INVALID"],
                "sample_identifier": "id",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"]

    def test_get_matrix_dataset_data_by_labels(
        self, client: TestClient, minimal_db: SessionWithUser, settings, mock_celery
    ):
        sample_type = factories.add_dimension_type(
            minimal_db,
            settings,
            settings.admin_users[0],
            name="sample_type_foo",
            display_name="Sample Type Foo",
            id_column="ID",
            axis="sample",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            metadata_df=pd.DataFrame(
                {
                    "ID": ["sampleID1", "sampleID2", "sampleID3"],
                    "label": ["sampleLabel1", "sampleLabel2", "sampleLabel3"],
                }
            ),
        )
        feature_type = factories.add_dimension_type(
            minimal_db,
            settings,
            settings.admin_users[0],
            name="feature_type_foobar",
            display_name="Feature Type Foobar",
            id_column="ID",
            axis="feature",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2", "featureID3"],
                    "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
                }
            ),
        )
        matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3"],
            values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        )
        matrix_dataset = factories.matrix_dataset(
            minimal_db,
            settings,
            sample_type="sample_type_foo",
            feature_type="feature_type_foobar",
            data_file=matrix_values,
        )
        # TODO: Delete after deprecated endpoint is deleted
        response = client.post(
            f"/datasets/data/{matrix_dataset.id}",
            json={
                "features": ["featureLabel1", "featureLabel2"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "sampleLabel3"],
                "sample_identifier": "label",
            },
        )
        assert response.json() == {
            "featureLabel1": {"sampleLabel2": 4.0, "sampleLabel3": 7.0},
            "featureLabel2": {"sampleLabel2": 5.0, "sampleLabel3": 8.0},
        }
        response = client.post(
            f"/datasets/matrix/{matrix_dataset.id}",
            json={
                "features": ["featureLabel1", "featureLabel2"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "sampleLabel3"],
                "sample_identifier": "label",
            },
        )
        assert response.json() == {
            "featureLabel1": {"sampleLabel2": 4.0, "sampleLabel3": 7.0},
            "featureLabel2": {"sampleLabel2": 5.0, "sampleLabel3": 8.0},
        }
        # Test strict keyword for missing features or samples
        response = client.post(
            f"/datasets/matrix/{matrix_dataset.id}?strict=True",
            json={
                "features": ["featureLabel1", "INVALID_FEATURE"],
                "feature_identifier": "label",
                "samples": ["sampleLabel2", "INVALID_SAMPLE"],
                "sample_identifier": "label",
            },
        )
        assert response.status_code == 400
        # Features checked first then
        assert (
            response.json()["detail"]
            == "1 missing features: ['INVALID_FEATURE'] and 1 missing samples: ['INVALID_SAMPLE']"
        )

    def test_get_tabular_dataset_data(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
        settings,
    ):
        """
        Test the loading of tabular data - including filtering by ID, label and column.
        """
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        # Give metadata for depmap model
        r_add_metadata_for_depmap_model = client.patch(
            "/types/sample/depmap_model/metadata",
            data={
                "name": "depmap model metadata",
                "annotation_type_mapping": json.dumps(
                    {"annotation_type_mapping": {"label": "text", "depmap_id": "text",}}
                ),
            },
            files={
                "metadata_file": (
                    "new_feature_metadata",
                    factories.tabular_csv_data_file(
                        cols=["label", "depmap_id"],
                        row_values=[
                            ["ach1", "ACH-1"],
                            ["ach2", "ACH-2"],
                            ["ach3", "ACH-3"],
                        ],
                    ),
                    "text/csv",
                )
            },
            headers=admin_headers,
        )
        assert_status_ok(
            r_add_metadata_for_depmap_model
        ), r_add_metadata_for_depmap_model.status_code == 200

        # Create tabular dataset
        tabular_file_1 = factories.tabular_csv_data_file(
            cols=[
                "depmap_id",
                "label",
                "col_1",
                "col_2",
                "col_3",
                "col_4",
                "col_5",
            ],  # NOTE: Add 'label' col to ensure endpoint only uses 'label' in dim type metadata
            row_values=[
                ["ACH-1", "other_label_1", 1, "hi", False, "cat1", '["a"]'],
                ["ACH-2", "other_label_2", np.NaN, "bye", np.NaN, "cat2", np.NaN],
            ],
        )

        tabular_file_ids_1, tabular_file_1_hash = factories.file_ids_and_md5_hash(
            client, tabular_file_1
        )

        tabular_dataset_1_response = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "Test Dataset 1",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids_1,
                "dataset_md5": tabular_file_1_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": None,
                "columns_metadata": {
                    "depmap_id": {"col_type": "text",},
                    "label": {"col_type": "text"},
                    "col_1": {"units": "a unit", "col_type": "continuous"},
                    "col_2": {"col_type": "text"},
                    "col_3": {"col_type": "binary"},
                    "col_4": {"col_type": "categorical"},
                    "col_5": {"col_type": "list_strings"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_1_response)
        tabular_dataset_1_id = tabular_dataset_1_response.json()["result"]["dataset"][
            "id"
        ]

        tabular_dataset_1 = (
            minimal_db.query(Dataset).filter_by(id=tabular_dataset_1_id).one()
        )
        assert tabular_dataset_1

        # Get a subset of the tabular dataset by id
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-2"],
                "identifier": "id",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-2": None}, "col_2": {"ACH-2": "bye"}}

        # Get a subset of the tabular dataset by label
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ach1", "ach2"],
                "identifier": "label",
                "columns": ["col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ach1": "hi", "ach2": "bye"}}

        # Test when indices not provided all data for those indices should be returned
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": None, "columns": ["col_2"],},
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ACH-1": "hi", "ACH-2": "bye"}}

        # When identifier 'label' is provided and indices not provided, the return should be all data with labels used as indices
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": "label", "columns": ["col_2"],},
            headers=admin_headers,
        )
        assert res.json() == {"col_2": {"ach1": "hi", "ach2": "bye"}}

        # When columns not provided, all columns are returned
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-1"], "identifier": "id", "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1"},
            "label": {"ACH-1": "other_label_1"},
            "col_1": {"ACH-1": 1},
            "col_2": {"ACH-1": "hi"},
            "col_3": {"ACH-1": False},
            "col_4": {"ACH-1": "cat1"},
            "col_5": {"ACH-1": ["a"]},
        }

        # When both columns and indices not provided, the entire dataset should return'
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": None, "identifier": None, "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1", "ACH-2": "ACH-2"},
            "label": {"ACH-1": "other_label_1", "ACH-2": "other_label_2"},
            "col_1": {"ACH-1": 1, "ACH-2": None},
            "col_2": {"ACH-1": "hi", "ACH-2": "bye"},
            "col_3": {"ACH-1": False, "ACH-2": None},
            "col_4": {"ACH-1": "cat1", "ACH-2": "cat2"},
            "col_5": {"ACH-1": ["a"], "ACH-2": None},
        }
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}", headers=admin_headers,
        )
        assert res.json() == {
            "depmap_id": {"ACH-1": "ACH-1", "ACH-2": "ACH-2"},
            "label": {"ACH-1": "other_label_1", "ACH-2": "other_label_2"},
            "col_1": {"ACH-1": 1, "ACH-2": None},
            "col_2": {"ACH-1": "hi", "ACH-2": "bye"},
            "col_3": {"ACH-1": False, "ACH-2": None},
            "col_4": {"ACH-1": "cat1", "ACH-2": "cat2"},
            "col_5": {"ACH-1": ["a"], "ACH-2": None},
        }

        # Test if no matches found with given query params --> empty df
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-3"], "identifier": "id", "columns": None,},
            headers=admin_headers,
        )
        assert res.json() == {}

        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-1"],
                "identifier": "id",
                "columns": ["nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

        # Test when either one of the indices or columns as request param does not exist in dataset
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={
                "indices": ["ACH-1", "ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["col_1", "nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-1": 1}}

        # With strict keyword
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}?strict=True",
            json={
                "indices": ["ACH-1", "ACH-3"],  # ACH-3 doesn't exist in dataset
                "identifier": "id",
                "columns": ["col_1", "nonexistant_col"],
            },
            headers=admin_headers,
        )
        assert res.status_code == 400
        assert (
            res.json()["detail"]
            == "1 missing columns: {'nonexistant_col'} and 1 missing indices: {'ACH-3'}"
        )

        # Raise error if identifier not provided and indices provided
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_1_id}",
            json={"indices": ["ACH-1"], "identifier": None, "columns": ["col_1"],},
            headers=admin_headers,
        )
        assert res.status_code == 400

    def test_get_tabular_dataset_data_no_index_metadata(
        self,
        client: TestClient,
        minimal_db: SessionWithUser,
        mock_celery,
        private_group: Dict,
        settings,
    ):
        """Get the data for a tabular dataset which has no metadata."""
        admin_headers = {"X-Forwarded-Email": settings.admin_users[0]}

        tabular_file_2 = factories.tabular_csv_data_file(
            cols=["depmap_id", "col_1", "col_2"], row_values=[["ACH-1", 1, "hi"]],
        )
        tabular_file_ids_2, tabular_file_2_hash = factories.file_ids_and_md5_hash(
            client, tabular_file_2
        )
        tabular_dataset_2_response = client.post(
            "/dataset-v2/",
            json={
                "format": "tabular",
                "name": "Test Dataset 2",
                "index_type": "depmap_model",
                "data_type": "User upload",
                "file_ids": tabular_file_ids_2,
                "dataset_md5": tabular_file_2_hash,
                "is_transient": False,
                "group_id": private_group["id"],
                "dataset_metadata": None,
                "columns_metadata": {
                    "depmap_id": {"col_type": "text",},
                    "col_1": {"units": "a unit", "col_type": "continuous"},
                    "col_2": {"col_type": "text"},
                },
            },
            headers=admin_headers,
        )
        assert_status_ok(tabular_dataset_2_response)
        tabular_dataset_2_id = tabular_dataset_2_response.json()["result"]["dataset"][
            "id"
        ]

        tabular_dataset_2 = (
            minimal_db.query(Dataset).filter_by(id=tabular_dataset_2_id).one()
        )
        assert tabular_dataset_2

        # Get a subset of the tabular dataset by id
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_2_id}",
            json={
                "indices": ["ACH-1"],
                "identifier": "id",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {"col_1": {"ACH-1": 1}, "col_2": {"ACH-1": "hi"}}

        # Get a subset of the tabular dataset by label (no data)
        res = client.post(
            f"/datasets/tabular/{tabular_dataset_2_id}",
            json={
                "indices": ["ach1"],
                "identifier": "label",
                "columns": ["col_1", "col_2"],
            },
            headers=admin_headers,
        )
        assert res.json() == {}

    def test_get_dimension_data(
        self, client: TestClient, minimal_db: SessionWithUser, public_group, settings,
    ):
        # Define label metadata for our features
        factories.add_dimension_type(
            minimal_db,
            settings,
            user=settings.admin_users[0],
            name="feature-with-metadata",
            display_name="Feature With Metadata",
            id_column="ID",
            annotation_type_mapping={
                "ID": AnnotationType.text,
                "label": AnnotationType.text,
            },
            axis="feature",
            metadata_df=pd.DataFrame(
                {
                    "ID": ["featureID1", "featureID2", "featureID3"],
                    "label": ["featureLabel1", "featureLabel2", "featureLabel3"],
                }
            ),
        )

        # Define a matrix dataset
        example_matrix_values = factories.matrix_csv_data_file_with_values(
            feature_ids=["featureID1", "featureID2", "featureID3"],
            sample_ids=["sampleID1", "sampleID2", "sampleID3"],
            values=np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
        )
        dataset_given_id = "dataset_123"
        dataset_with_metadata = factories.matrix_dataset(
            minimal_db,
            settings,
            feature_type="feature-with-metadata",
            data_file=example_matrix_values,
            given_id=dataset_given_id,
        )

        # Test get by feature ID
        response = client.post(
            "/datasets/dimension/data",
            json={
                "dataset_id": dataset_with_metadata.id,
                "identifier": "sampleID1",
                "identifier_type": "sample_id",
            },
            headers={"X-Forwarded-User": "some-public-user"},
        )

        assert_status_ok(response)
        response_content = response.json()
        assert response_content is not None
        assert response_content["ids"] == ["featureID1", "featureID2", "featureID3"]
        assert response_content["labels"] == [
            "featureLabel1",
            "featureLabel2",
            "featureLabel3",
        ]
        assert response_content["values"] == [1, 2, 3]


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
        matrix_file_ids, matrix_hash = factories.file_ids_and_md5_hash(
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
        tabular_file_ids, tabular_hash = factories.file_ids_and_md5_hash(
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
        tabular_file_ids, tabular_hash = factories.file_ids_and_md5_hash(
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
        assert len(minimal_db.query(Dataset).all()) == 0
        assert len(minimal_db.query(TabularDataset).all()) == 0
        assert len(minimal_db.query(TabularColumn).all()) == 0
        assert len(minimal_db.query(TabularCell).all()) == 0
        assert len(minimal_db.query(PropertyToIndex).all()) == 0
        assert len(minimal_db.query(DimensionSearchIndex).all()) == 0


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
