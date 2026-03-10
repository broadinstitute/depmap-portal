import io
import os
import sqlite3

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType
from tests import factories
from tests.utils import assert_status_ok, assert_status_not_ok, upload_and_get_file_ids


def _create_gene_dimension_type(minimal_db: SessionWithUser, settings):
    """Create a 'gene' dimension type for testing"""
    factories.feature_type(
        minimal_db,
        user=settings.admin_users[0],
        name="gene",
        display_name="Gene",
        id_column="entrez_id",
    )
    minimal_db.flush()


def _create_test_matrix_dataset(
    minimal_db: SessionWithUser,
    settings,
    feature_type="gene",
    sample_type="depmap_model",
    feature_ids=None,
    sample_ids=None,
):
    """Create a test matrix dataset"""
    if feature_ids is None:
        feature_ids = ["feature1", "feature2", "feature3"]
    if sample_ids is None:
        sample_ids = ["ACH-1", "ACH-2"]

    data_file = factories.matrix_csv_data_file_with_values(
        feature_ids=feature_ids,
        sample_ids=sample_ids,
        values=np.array([[1.0] * len(feature_ids)] * len(sample_ids)),
    )
    dataset = factories.matrix_dataset(
        minimal_db,
        settings,
        feature_type=feature_type,
        sample_type=sample_type,
        data_file=data_file,
    )
    return dataset


def _create_test_parquet(tmpdir, features, predictions_dataset_id):
    """Create a test parquet file with predictive model results"""
    rows = []
    for feature_id in features:
        row = {
            "actuals_feature_given_id": feature_id,
            "prediction_actual_correlation": 0.8,
            "feature_1_dataset_id": predictions_dataset_id,
            "feature_1_given_id": f"pred_{feature_id}",
            "feature_1_label": f"Predicted {feature_id}",
            "feature_1_importance": 0.5,
            "feature_1_correlation": 0.9,
            "feature_2_dataset_id": predictions_dataset_id,
            "feature_2_given_id": f"pred2_{feature_id}",
            "feature_2_label": f"Second {feature_id}",
            "feature_2_importance": 0.3,
            "feature_2_correlation": 0.7,
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    parquet_path = str(tmpdir.join("results.parquet"))
    df.to_parquet(parquet_path)
    return parquet_path


def test_config_crud_operations(
    client: TestClient, minimal_db: SessionWithUser, settings
):
    """Test creating, reading, updating, and deleting configs"""
    admin_user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-User": admin_user}

    # Create the gene dimension type
    _create_gene_dimension_type(minimal_db, settings)

    # Initially no configs
    response = client.get("/temp/predictive_models/configs", headers=admin_headers)
    assert_status_ok(response)
    assert response.json() == []

    # Create configs for 'gene' dimension type
    response = client.post(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "dna",
                    "model_config_description": "DNA-based predictive features",
                },
                {
                    "model_config_name": "rna",
                    "model_config_description": "RNA-based predictive features",
                },
            ]
        },
        headers=admin_headers,
    )
    assert_status_ok(response)
    data = response.json()
    assert data["dimension_type_name"] == "gene"
    assert len(data["configs"]) == 2

    # Get configs for dimension type
    response = client.get("/temp/predictive_models/configs/gene", headers=admin_headers)
    assert_status_ok(response)
    data = response.json()
    assert data["dimension_type_name"] == "gene"
    assert len(data["configs"]) == 2

    # Get all configs
    response = client.get("/temp/predictive_models/configs", headers=admin_headers)
    assert_status_ok(response)
    data = response.json()
    assert len(data) == 1
    assert data[0]["dimension_type_name"] == "gene"

    # Update configs (replace all)
    response = client.patch(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "lineage",
                    "model_config_description": "Lineage-based predictive features",
                },
            ]
        },
        headers=admin_headers,
    )
    assert_status_ok(response)
    data = response.json()
    assert len(data["configs"]) == 1
    assert data["configs"][0]["model_config_name"] == "lineage"

    # Delete configs
    response = client.delete(
        "/temp/predictive_models/configs/gene", headers=admin_headers
    )
    assert_status_ok(response)

    # Verify deleted
    response = client.get("/temp/predictive_models/configs/gene", headers=admin_headers)
    assert response.status_code == 404


def test_config_admin_only(client: TestClient, minimal_db: SessionWithUser, settings):
    """Test that config operations require admin access"""
    # Create the gene dimension type
    _create_gene_dimension_type(minimal_db, settings)

    non_admin_headers = {"X-Forwarded-User": "regular-user@example.com"}

    # Non-admin cannot create configs
    response = client.post(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "dna",
                    "model_config_description": "DNA-based predictive features",
                }
            ]
        },
        headers=non_admin_headers,
    )
    assert response.status_code == 403


def test_bulk_load_and_query(
    client: TestClient, minimal_db: SessionWithUser, settings, tmpdir
):
    """Test bulk loading results and querying them"""
    admin_user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-User": admin_user}

    # Create the gene dimension type
    _create_gene_dimension_type(minimal_db, settings)

    # Create test datasets
    actuals_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["SOX10", "BRAF", "KRAS"]
    )
    predictions_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["pred_SOX10", "pred_BRAF", "pred2_SOX10"]
    )
    minimal_db.commit()

    # Create a config
    response = client.post(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "dna",
                    "model_config_description": "DNA-based predictive features",
                }
            ]
        },
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Create parquet file
    parquet_path = _create_test_parquet(
        tmpdir, ["SOX10", "BRAF", "KRAS"], predictions_dataset.id
    )

    # Upload the parquet file
    file_ids, md5 = upload_and_get_file_ids(client, filename=parquet_path)

    # Bulk load results
    response = client.post(
        f"/temp/predictive_models/config/gene/dna/{actuals_dataset.id}",
        json={
            "file_ids": file_ids,
            "md5": md5,
            "predictions_dataset_id": predictions_dataset.id,
        },
        headers=admin_headers,
    )
    assert_status_ok(response)
    assert response.json()["status"] == "loaded"

    # Query for a specific feature
    response = client.get(
        f"/temp/predictive_models/feature/{actuals_dataset.id}/SOX10",
        headers=admin_headers,
    )
    assert_status_ok(response)
    data = response.json()

    assert data["actuals_dataset"]["id"] == actuals_dataset.id
    assert data["actuals_feature_given_id"] == "SOX10"
    assert len(data["model_fits"]) == 1

    model_fit = data["model_fits"][0]
    assert model_fit["config_name"] == "dna"
    assert model_fit["prediction_actual_correlation"] == pytest.approx(0.8)
    assert len(model_fit["top_features"]) == 2

    # Check top features
    top_feature = model_fit["top_features"][0]
    assert top_feature["rank"] == 1
    assert top_feature["feature_given_id"] == "pred_SOX10"
    assert top_feature["importance"] == pytest.approx(0.5)


def test_query_nonexistent_feature(
    client: TestClient, minimal_db: SessionWithUser, settings, tmpdir
):
    """Test querying for a feature that doesn't exist in results"""
    admin_user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-User": admin_user}

    # Create the gene dimension type
    _create_gene_dimension_type(minimal_db, settings)

    # Create test datasets
    actuals_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["SOX10", "BRAF"]
    )
    predictions_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["pred_SOX10"]
    )
    minimal_db.commit()

    # Create a config
    response = client.post(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "rna",
                    "model_config_description": "RNA-based predictive features",
                }
            ]
        },
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Create parquet file with only SOX10
    parquet_path = _create_test_parquet(tmpdir, ["SOX10"], predictions_dataset.id)

    # Upload and load
    file_ids, md5 = upload_and_get_file_ids(client, filename=parquet_path)
    response = client.post(
        f"/temp/predictive_models/config/gene/rna/{actuals_dataset.id}",
        json={
            "file_ids": file_ids,
            "md5": md5,
            "predictions_dataset_id": predictions_dataset.id,
        },
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Query for BRAF which exists in dataset but not in results
    response = client.get(
        f"/temp/predictive_models/feature/{actuals_dataset.id}/BRAF",
        headers=admin_headers,
    )
    assert_status_ok(response)
    data = response.json()

    # Should return empty model_fits
    assert data["actuals_feature_given_id"] == "BRAF"
    assert len(data["model_fits"]) == 0


def test_delete_results(
    client: TestClient, minimal_db: SessionWithUser, settings, tmpdir
):
    """Test deleting results"""
    admin_user = settings.admin_users[0]
    admin_headers = {"X-Forwarded-User": admin_user}

    # Create the gene dimension type
    _create_gene_dimension_type(minimal_db, settings)

    # Create test datasets
    actuals_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["SOX10"]
    )
    predictions_dataset = _create_test_matrix_dataset(
        minimal_db, settings, feature_ids=["pred_SOX10"]
    )
    minimal_db.commit()

    # Create a config
    response = client.post(
        "/temp/predictive_models/configs/gene",
        json={
            "configs": [
                {
                    "model_config_name": "lineage",
                    "model_config_description": "Lineage-based predictive features",
                }
            ]
        },
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Create and load parquet
    parquet_path = _create_test_parquet(tmpdir, ["SOX10"], predictions_dataset.id)
    file_ids, md5 = upload_and_get_file_ids(client, filename=parquet_path)

    response = client.post(
        f"/temp/predictive_models/config/gene/lineage/{actuals_dataset.id}",
        json={
            "file_ids": file_ids,
            "md5": md5,
            "predictions_dataset_id": predictions_dataset.id,
        },
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Verify results exist
    response = client.get(
        f"/temp/predictive_models/feature/{actuals_dataset.id}/SOX10",
        headers=admin_headers,
    )
    assert_status_ok(response)
    assert len(response.json()["model_fits"]) == 1

    # Delete results
    response = client.delete(
        f"/temp/predictive_models/config/gene/lineage/{actuals_dataset.id}",
        headers=admin_headers,
    )
    assert_status_ok(response)

    # Verify results are gone
    response = client.get(
        f"/temp/predictive_models/feature/{actuals_dataset.id}/SOX10",
        headers=admin_headers,
    )
    assert_status_ok(response)
    assert len(response.json()["model_fits"]) == 0


def test_query_nonexistent_dataset(
    client: TestClient, minimal_db: SessionWithUser, settings
):
    """Test querying for a dataset that doesn't exist"""
    admin_headers = {"X-Forwarded-User": settings.admin_users[0]}

    response = client.get(
        "/temp/predictive_models/feature/nonexistent-dataset-id/SOX10",
        headers=admin_headers,
    )
    assert response.status_code == 404
