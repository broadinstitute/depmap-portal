from typing import Dict
import hashlib
import pytest

from fastapi.testclient import TestClient
import pandas as pd
from sqlalchemy import and_

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import ValueType
from breadbox.models.dataset import (
    CatalogNode,
    DatasetFeature,
    DatasetSample,
    TabularColumn,
    Dataset,
)
from breadbox.schemas.dataset import (
    MatrixDatasetParams,
    TableDatasetParams,
    ColumnMetadata,
    AnnotationType,
)
from breadbox.schemas.custom_http_exception import FileValidationError
from breadbox.compute.dataset_uploads_tasks import dataset_upload

from tests import factories

# pyright seems to be having trouble recognizing non-required files when annotated with Field
# so, just putting the defaults here and passing them in each time
_default_params = {"prority": None, "taiga_id": None}


def test_matrix_dataset_uploads(
    client: TestClient, minimal_db: SessionWithUser, private_group: Dict, settings
):
    file = factories.continuous_matrix_csv_file()
    file_ids = []
    chunk = file.readline()
    while chunk:
        response = client.post(
            "/uploads/file", files={"file": ("filename", chunk, "text/csv")},
        )
        assert response.status_code == 200
        file_ids.append(response.json()["file_id"])
        chunk = file.readline()

    assert len(file_ids) == 3
    expected_md5 = "820882fc8dc0df48728c74db24c64fa1"

    matrix_params = MatrixDatasetParams(
        format="matrix",
        name="a dataset",
        units="a unit",
        feature_type="generic",
        sample_type="depmap_model",
        data_type="User upload",
        file_ids=file_ids,
        dataset_md5=expected_md5,
        is_transient=False,
        group_id=private_group["id"],
        value_type=ValueType.continuous,
        allowed_values=None,
        dataset_metadata={"yah": "nah"},
        **_default_params
    )
    user = settings.admin_users[0]
    matrix_dataset_w_simple_metadata = dataset_upload(minimal_db, matrix_params, user)
    assert matrix_dataset_w_simple_metadata.datasetId
    dataset_id = matrix_dataset_w_simple_metadata.datasetId

    # Test feature and sample indexes and catalog nodes added
    feature_indexes = (
        minimal_db.query(DatasetFeature)
        .filter(DatasetFeature.dataset_id == dataset_id)
        .all()
    )
    sample_indexes = (
        minimal_db.query(DatasetSample)
        .filter(DatasetFeature.dataset_id == dataset_id)
        .all()
    )
    assert len(feature_indexes) == 3  # Number of feaures should be 3
    assert len(sample_indexes) == 2  # Number of feaures should be 2

    matrix_params_only_sample_type = MatrixDatasetParams(
        format="matrix",
        name="a dataset",
        units="a unit",
        feature_type=None,
        sample_type="depmap_model",
        data_type="User upload",
        file_ids=file_ids,
        dataset_md5=expected_md5,
        is_transient=False,
        group_id=private_group["id"],
        value_type=ValueType.continuous,
        allowed_values=None,
        dataset_metadata={"yah": "nah"},
        **_default_params
    )
    matrix_only_sample_type = dataset_upload(
        minimal_db, matrix_params_only_sample_type, settings.admin_users[0]
    )
    assert matrix_only_sample_type.datasetId
    dataset_id = matrix_only_sample_type.datasetId

    # Test feature and sample indexes
    features = (
        minimal_db.query(DatasetFeature)
        .filter(
            and_(
                DatasetFeature.dataset_id == dataset_id,
                DatasetFeature.dataset_dimension_type.is_(None),
            )
        )
        .all()
    )
    samples = (
        minimal_db.query(DatasetSample)
        .filter(DatasetFeature.dataset_id == dataset_id)
        .all()
    )
    assert len(features) == 3  # Number of feaures should be 3
    assert len(samples) == 2  # Number of samples should be 2


def test_tabular_uploads(
    client: TestClient, minimal_db: SessionWithUser, private_group: Dict, settings
):
    ### Test tabular dataset ###
    factories.add_dimension_type(
        minimal_db,
        settings,
        settings.admin_users[0],
        "test-sample",
        "sample_id",
        "sample",
        metadata_df=pd.DataFrame({"sample_id": ["ID1", "ID2"]}),
        annotation_type_mapping={"sample_id": AnnotationType.text},
    )

    tabular_data_file = factories.tabular_csv_data_file(
        cols=["depmap_id", "attr1", "attr2", "attr3", "fk"],
        row_values=[
            ["ACH-1", 1.0, 0, '["a"]', "ID1"],
            ["ACH-2", 2.0, 1, '["d", "c"]', "ID2"],
        ],
    )
    tabular_file_ids, hash = factories.file_ids_and_md5_hash(client, tabular_data_file)

    assert len(tabular_file_ids) == 3
    tabular_params = TableDatasetParams(
        format="tabular",
        name="a table dataset",
        index_type="depmap_model",
        data_type="User upload",
        file_ids=tabular_file_ids,
        dataset_md5=hash,
        is_transient=False,
        group_id=private_group["id"],
        dataset_metadata={"yah": "nah"},
        columns_metadata={
            "depmap_id": ColumnMetadata(col_type=AnnotationType.text),
            "attr1": ColumnMetadata(
                units="some units", col_type=AnnotationType.continuous
            ),
            "attr2": ColumnMetadata(col_type=AnnotationType.binary),
            "attr3": ColumnMetadata(col_type=AnnotationType.list_strings),
            "fk": ColumnMetadata(
                col_type=AnnotationType.text, references="test-sample"
            ),
        },
        **_default_params
    )
    user = settings.admin_users[0]
    tabular_dataset = dataset_upload(minimal_db, tabular_params, user)
    assert tabular_dataset.datasetId
    tabular_dataset_id = tabular_dataset.datasetId
    dataset = minimal_db.query(Dataset).filter(Dataset.id == tabular_dataset_id).one()
    assert dataset.upload_date is not None
    assert dataset.md5_hash == hash
    assert len(dataset.dimensions) == 5
    assert len(dataset.dataset_references) == 1

    tabular_attr2 = (
        minimal_db.query(TabularColumn).filter(TabularColumn.given_id == "attr2").one()
    )
    for cell in tabular_attr2.tabular_cells:
        assert cell.value in ["True", "False"]


def test_tabular_dataset_bad_typings_params(
    minimal_db, client, settings, private_group
):
    tabular_data_file = factories.tabular_csv_data_file(
        cols=["depmap_id", "attr1", "attr2", "attr3"],
        row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-2", 2.0, 1, '["d", "c"]']],
    )
    tabular_file_ids, md5 = factories.file_ids_and_md5_hash(client, tabular_data_file)

    with pytest.raises(Exception):
        tabular_dataset_bad_typings_params = TableDatasetParams(
            format="tabular",
            name="a table dataset",
            index_type="depmap_model",
            data_type="User upload",
            file_ids=tabular_file_ids,
            dataset_md5=md5,
            is_transient=False,
            group_id=private_group["id"],
            dataset_metadata={"yah": "nah"},
            columns_metadata={
                "depmap_id": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.text}
                ),
                "attr1": ColumnMetadata(
                    **{"units": "some units", "col_type": AnnotationType.continuous}
                ),
                "attr3": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.continuous,}
                ),  # incorrect typing
            },
            **_default_params
        )


def test_tabular_bad_list_str_col(minimal_db, client, settings, private_group):
    with pytest.raises(FileValidationError):
        # list string value is not all strings
        tabular_data_file_bad_list_strings = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1", "attr2", "attr3"],
            row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-2", 2.0, 1, '[1, "c"]']],
        )
        (
            bad_list_strings_file_ids,
            bad_list_strings_hash,
        ) = factories.file_ids_and_md5_hash(client, tabular_data_file_bad_list_strings)
        bad_list_str_params = TableDatasetParams(
            format="tabular",
            name="a table dataset2",
            index_type="depmap_model",
            data_type="User upload",
            file_ids=bad_list_strings_file_ids,
            dataset_md5=bad_list_strings_hash,
            is_transient=False,
            group_id=private_group["id"],
            dataset_metadata={"yah": "nah"},
            columns_metadata={
                "depmap_id": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.text}
                ),
                "attr1": ColumnMetadata(
                    **{"units": "some units", "col_type": AnnotationType.continuous}
                ),
                "attr2": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.binary}
                ),
                "attr3": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.list_strings}
                ),
            },
            **_default_params
        )
        dataset_upload(minimal_db, bad_list_str_params, settings.admin_users[0])


def test_tabular_dup_ids_failure(client, private_group, minimal_db, settings):
    with pytest.raises(FileValidationError):
        repeated_ids_file = factories.tabular_csv_data_file(
            cols=["depmap_id", "attr1", "attr2", "attr3"],
            row_values=[["ACH-1", 1.0, 0, '["a"]'], ["ACH-1", 2.0, 1, '["b", "c"]']],
        )
        repeated_ids_file_ids, repeated_ids_hash = factories.file_ids_and_md5_hash(
            client, repeated_ids_file
        )
        repeated_ids_params = TableDatasetParams(
            format="tabular",
            name="a table dataset2",
            index_type="depmap_model",
            data_type="User upload",
            file_ids=repeated_ids_file_ids,
            dataset_md5=repeated_ids_hash,
            is_transient=False,
            group_id=private_group["id"],
            dataset_metadata={"yah": "nah"},
            columns_metadata={
                "depmap_id": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.text}
                ),
                "attr1": ColumnMetadata(
                    **{"units": "some units", "col_type": AnnotationType.continuous}
                ),
                "attr2": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.binary}
                ),
                "attr3": ColumnMetadata(
                    **{"units": None, "col_type": AnnotationType.list_strings}
                ),
            },
            **_default_params
        )
        dataset_upload(minimal_db, repeated_ids_params, settings.admin_users[0])
