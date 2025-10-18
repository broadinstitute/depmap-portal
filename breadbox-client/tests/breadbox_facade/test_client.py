import uuid

import pandas as pd

from breadbox_facade import AXIS_SAMPLE, COL_TYPE_CONTINUOUS, COL_TYPE_TEXT, BBClient, ColumnMetadata

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
