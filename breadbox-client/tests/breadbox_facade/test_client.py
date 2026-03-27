import io
import uuid

import pandas as pd

from breadbox_client.models import ModelConfigIn
from breadbox_facade import AXIS_SAMPLE, AXIS_FEATURE, COL_TYPE_CONTINUOUS, COL_TYPE_TEXT, BBClient, ColumnMetadata

def unique_name(prefix):
    return prefix + str(uuid.uuid4())


def _create_data_type(client: BBClient):
    name = unique_name("datatype")
    client.add_data_type(name)
    return name

def test_groups(breadbox_client):
    # exercises creating and getting groups

    new_group = unique_name("group")

    # make sure it doesn't exists
    groups = breadbox_client.get_groups()
    assert new_group not in [g.name for g in groups]

    # create the group
    breadbox_client.add_group(new_group)

    # and now make sure it does exist
    groups = breadbox_client.get_groups()
    assert new_group in [g.name for g in groups]


def test_create_dimension_type(breadbox_client):
    # exercises both creating data tables as well as creating dimension type
    data_type = _create_data_type(breadbox_client)

    # create the feature type with no metadata
    index_type = unique_name("feature-type")
    breadbox_client.add_dimension_type(name=index_type, id_column="label", axis=AXIS_SAMPLE)

    # now that we have a feature type, we can create a table indexed by that feature type
    dataset_id = breadbox_client.add_table_dataset(
        name=unique_name("add-matrix"),
        group_id=breadbox_client.PUBLIC_GROUP_ID,
        index_type=index_type,
        data_df=pd.DataFrame({"label": ["X"], "score1": [1.0]}),
        data_type=data_type,
        columns_metadata={
            "label": ColumnMetadata(col_type=COL_TYPE_TEXT),
            "score1": ColumnMetadata(col_type=COL_TYPE_CONTINUOUS, units="ducks"),
        },
        timeout=5,
    )["datasetId"]

    # make sure it successfully got created
    response = breadbox_client.get_dataset(dataset_id)
    assert response.id == dataset_id

    # now associate the data table with the dimension type
    breadbox_client.update_dimension_type(name=index_type, metadata_dataset_id=dataset_id, properties_to_index=["label"])

    # and verify that took effect
    dim_type = breadbox_client.get_dimension_type(name=index_type)
    assert dim_type.metadata_dataset_id == dataset_id


def test_add_matrix_dataset(breadbox_client):

    data_type = _create_data_type(breadbox_client)

    dataset_id = breadbox_client.add_matrix_dataset(
        name=unique_name("add-matrix"),
        units="ponies",
        feature_type=None,
        data_type=data_type,
        data_df=pd.DataFrame({"label": ["X"], "score1": [1.0]}),
        sample_type="depmap_model",
        group_id=breadbox_client.PUBLIC_GROUP_ID,
        timeout=5,
    )["datasetId"]

    response = breadbox_client.get_dataset(dataset_id)
    assert response.id == dataset_id


def test_add_dataset_with_dataset_metadata(breadbox_client):

    data_type = _create_data_type(breadbox_client)

    dataset_id = breadbox_client.add_matrix_dataset(
        name=unique_name("add-matrix"),
        units="ponies",
        feature_type=None,
        data_type=data_type,
        data_df=pd.DataFrame({"label": ["X"], "score1": [1.0]}),
        sample_type="depmap_model",
        group_id=breadbox_client.PUBLIC_GROUP_ID,
        timeout=5,
        dataset_metadata={"some": "value"},
    )["datasetId"]

    response = breadbox_client.get_dataset(dataset_id)
    assert response.id == dataset_id
    assert response.dataset_metadata is not None
    assert response.dataset_metadata.to_dict() == {"some": "value"}


def _make_predictive_results_parquet(feature_ids, predictions_dataset_id) -> bytes:
    """Create a parquet file with predictive model results in the expected format."""
    rows = []
    for feature_id in feature_ids:
        row = {
            "actuals_feature_given_id": feature_id,
            "prediction_actual_correlation": 0.8,
            "feature_1_dataset_id": predictions_dataset_id,
            "feature_1_given_id": f"pred_{feature_id}",
            "feature_1_label": f"Predicted {feature_id}",
            "feature_1_importance": 0.5,
            "feature_1_correlation": 0.9,
        }
        rows.append(row)
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    df.to_parquet(buf)
    return buf.getvalue()


def test_predictive_models(breadbox_client: BBClient):
    data_type = _create_data_type(breadbox_client)

    # Create a feature dimension type (axis=feature so it can be used as feature_type)
    dim_type_name = unique_name("gene-type")
    breadbox_client.add_dimension_type(name=dim_type_name, id_column="label", axis=AXIS_FEATURE)

    # Create actuals and predictions datasets
    feature_ids = ["feat1", "feat2"]
    sample_ids = ["ACH-1", "ACH-2"]

    actuals_df = pd.DataFrame(
        {"label": sample_ids, **{fid: [1.0, 2.0] for fid in feature_ids}}
    )
    actuals_id = breadbox_client.add_matrix_dataset(
        name=unique_name("actuals"),
        units="score",
        data_type=data_type,
        feature_type=dim_type_name,
        sample_type="depmap_model",
        data_df=actuals_df,
        group_id=breadbox_client.PUBLIC_GROUP_ID,
        timeout=15,
    )["datasetId"]

    pred_feature_ids = [f"pred_{fid}" for fid in feature_ids]
    predictions_df = pd.DataFrame(
        {"label": sample_ids, **{fid: [0.9, 1.8] for fid in pred_feature_ids}}
    )
    predictions_id = breadbox_client.add_matrix_dataset(
        name=unique_name("predictions"),
        units="score",
        data_type=data_type,
        feature_type=None,
        sample_type="depmap_model",
        data_df=predictions_df,
        group_id=breadbox_client.PUBLIC_GROUP_ID,
        timeout=15,
    )["datasetId"]

    # get_all_predictive_model_results returns a list (initially may or may not be empty)
    all_results = breadbox_client.get_all_predictive_model_results()
    assert isinstance(all_results, list)

    # get_all_predictive_model_configs returns a list
    all_configs = breadbox_client.get_all_predictive_model_configs()
    assert isinstance(all_configs, list)

    # create_predictive_model_configs
    created = breadbox_client.create_predictive_model_configs(
        dim_type_name,
        [ModelConfigIn(model_config_name="dna", model_config_description="DNA-based features")],
    )
    assert created.dimension_type_name == dim_type_name
    assert len(created.configs) == 1

    # get_predictive_model_configs_for_dimension_type
    fetched = breadbox_client.get_predictive_model_configs_for_dimension_type(dim_type_name)
    assert fetched.dimension_type_name == dim_type_name
    assert fetched.configs[0].model_config_name == "dna"

    # update_predictive_model_configs
    updated = breadbox_client.update_predictive_model_configs(
        dim_type_name,
        [
            ModelConfigIn(model_config_name="dna", model_config_description="DNA-based features"),
            ModelConfigIn(model_config_name="rna", model_config_description="RNA-based features"),
        ],
    )
    assert len(updated.configs) == 2

    # bulk_load_predictive_model_results
    parquet_bytes = _make_predictive_results_parquet(feature_ids, predictions_id)
    load_result = breadbox_client.bulk_load_predictive_model_results(
        dimension_type_name=dim_type_name,
        config_name="dna",
        actuals_dataset_id=actuals_id,
        predictions_dataset_id=predictions_id,
        results_file=io.BytesIO(parquet_bytes),
        etag="v1",
    )
    assert load_result["status"] == "loaded"

    # get_predictive_models_for_feature
    feature_result = breadbox_client.get_predictive_models_for_feature(actuals_id, "feat1")
    assert feature_result.actuals_feature_given_id == "feat1"
    assert len(feature_result.model_fits) >= 1

    # delete_predictive_model_results
    breadbox_client.delete_predictive_model_results(dim_type_name, "dna", actuals_id)
    after_delete = breadbox_client.get_predictive_models_for_feature(actuals_id, "feat1")
    assert len(after_delete.model_fits) == 0

    # delete_predictive_model_configs
    breadbox_client.delete_predictive_model_configs(dim_type_name)
