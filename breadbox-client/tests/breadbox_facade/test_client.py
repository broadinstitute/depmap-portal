import uuid

import pandas as pd

from breadbox_facade import AXIS_SAMPLE, COL_TYPE_CONTINUOUS, COL_TYPE_TEXT, BBClient, ColumnMetadata

user = "admin"
base_url = "http://localhost:8000"


def unique_name(prefix):
    return prefix + str(uuid.uuid4())


def _create_data_type(client: BBClient):
    name = unique_name("datatype")
    client.add_data_type(name)
    return name


def test_groups():
    # exercises creating and getting groups
    client = BBClient(base_url, user)

    new_group = unique_name("group")

    # make sure it doesn't exists
    groups = client.get_groups()
    assert new_group not in [g.name for g in groups]

    # create the group
    client.add_group(new_group)

    # and now make sure it does exist
    groups = client.get_groups()
    assert new_group in [g.name for g in groups]


def test_create_dimension_type():
    # exercises both creating data tables as well as creating dimension type
    client = BBClient(base_url, user)

    data_type = _create_data_type(client)

    # create the feature type with no metadata
    index_type = unique_name("feature-type")
    client.add_dimension_type(name=index_type, id_column="label", axis=AXIS_SAMPLE)

    # now that we have a feature type, we can create a table indexed by that feature type
    dataset_id = client.add_table_dataset(
        name=unique_name("add-matrix"),
        group_id=client.PUBLIC_GROUP_ID,
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
    response = client.get_dataset(dataset_id)
    assert response.id == dataset_id

    # now associate the data table with the dimension type
    client.update_dimension_type(name=index_type, metadata_dataset_id=dataset_id, properties_to_index=["label"])

    # and verify that took effect
    dim_type = client.get_dimension_type(name=index_type)
    assert dim_type.metadata_dataset_id == dataset_id


def test_add_matrix_dataset():
    client = BBClient(base_url, user)

    data_type = _create_data_type(client)

    dataset_id = client.add_matrix_dataset(
        name=unique_name("add-matrix"),
        units="ponies",
        feature_type=None,
        data_type=data_type,
        data_df=pd.DataFrame({"label": ["X"], "score1": [1.0]}),
        sample_type="depmap_model",
        group_id=client.PUBLIC_GROUP_ID,
        timeout=5,
    )["datasetId"]

    response = client.get_dataset(dataset_id)
    assert response.id == dataset_id


def test_add_dataset_with_dataset_metadata():
    client = BBClient(base_url, user)

    data_type = _create_data_type(client)

    dataset_id = client.add_matrix_dataset(
        name=unique_name("add-matrix"),
        units="ponies",
        feature_type=None,
        data_type=data_type,
        data_df=pd.DataFrame({"label": ["X"], "score1": [1.0]}),
        sample_type="depmap_model",
        group_id=client.PUBLIC_GROUP_ID,
        timeout=5,
        dataset_metadata={"some": "value"},
    )["datasetId"]

    response = client.get_dataset(dataset_id)
    assert response.id == dataset_id
    assert response.dataset_metadata is not None
    assert response.dataset_metadata.to_dict() == {"some": "value"}
