from typing import Any, List, Optional, Union

import typing
from breadbox.api.groups import add_group
import breadbox.api.dimension_types as types_api
from breadbox.service.dataset import add_dimension_type, add_tabular_dataset
from breadbox.crud.data_type import add_data_type
from breadbox.crud import dataset as dataset_crud

from io import BytesIO, StringIO

from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import Dataset, ValueType
from breadbox.crud.access_control import (
    PUBLIC_GROUP_ID,
    TRANSIENT_GROUP_ID,
)
from breadbox.io.upload_utils import create_upload_file

from breadbox.schemas.group import GroupIn
import csv
import numpy as np
from factory import Factory
from breadbox import config
from breadbox.config import Settings as realSettings
from breadbox.schemas.types import AnnotationTypeMap, IdMapping, AnnotationType

from breadbox.compute import dataset_tasks
from breadbox.schemas.dataset import ColumnMetadata, AnnotationType
from breadbox.schemas.dataset import TabularDatasetIn
import uuid
import breadbox.crud.dimension_types as types_crud
import pandas as pd
import hashlib

_unique_name_counter = 0


class SettingsFactory(Factory):
    class Meta:
        model = config.Settings

    sqlalchemy_database_url = "invalid path"
    filestore_location = "invalid path"
    compute_results_location = "invalid path"
    admin_users = []
    use_depmap_proxy = False
    default_user = "test@sample.com"
    host_scheme_override = None
    api_prefix = ""
    # used for configuring CORS allowed origins
    origins = []
    breadbox_secret = "x"


def unique_name(prefix=""):
    global _unique_name_counter
    _unique_name_counter += 1
    return f"{prefix}{_unique_name_counter}"


class _CallIfOmitted:
    def __init__(self, fn):
        self.fn = fn

    def __call__(self, *args):
        return self.fn(*args)


def _handle_call_if_omitted(obj, *args):
    if isinstance(obj, _CallIfOmitted):
        return obj(*args)
    return obj


def group(
    db: SessionWithUser,
    settings: config.Settings,
    name=_CallIfOmitted(lambda: unique_name("group")),
    user=_CallIfOmitted(lambda settings: settings.admin_users[0]),
) -> str:
    group = add_group(
        GroupIn(name=_handle_call_if_omitted(name)),
        db,
        user=_handle_call_if_omitted(user, settings),
        settings=settings,
    )

    return group


def feature_type(
    db: SessionWithUser,
    user: str,
    name: str,
    display_name: Optional[str] = None,
    id_column="id",
):
    settings: realSettings = MockSettings(user)  # pyright: ignore
    display_name_val = display_name if display_name else name
    add_dimension_type(
        db,
        settings,
        user,
        name=name,
        display_name=display_name_val,
        id_column=id_column,
        axis="feature",
    )
    db.flush()


def sample_type(
    db: SessionWithUser,
    user: str,
    name: str,
    display_name: Optional[str] = None,
    id_column="id",
):
    settings: realSettings = MockSettings(user)  # pyright: ignore
    display_name_val = display_name if display_name else name
    add_dimension_type(
        db,
        settings,
        user,
        name=name,
        display_name=display_name_val,
        id_column=id_column,
        axis="sample",
    )
    db.flush()


class MockSettings:
    def __init__(self, user):
        self.admin_users = [user]


def data_type(db: SessionWithUser, name: str):
    data_type_ = add_data_type(db, name)
    db.flush()
    return data_type_


def continuous_matrix_csv_file(
    feature_ids=["A", "B", "C"], sample_ids=["ACH-1", "ACH-2"]
):
    "construct a file stream which contains a csv file with the provided row/columns"
    import csv
    from io import StringIO, BytesIO

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow([""] + feature_ids)
    counter = 0
    for sample_id in sample_ids:
        row = [sample_id] + [str(counter + i) for i in range(len(feature_ids))]
        counter += len(feature_ids)
        w.writerow(row)

    result = BytesIO(buf.getvalue().encode("utf8"))
    assert result.tell() == 0
    return result


def matrix_csv_data_file_with_values(
    values: Union[List, np.ndarray] = ["Thing1", "Thing2", "Thing3"],
    feature_ids=["A", "B", "C"],
    sample_ids=["ACH-1", "ACH-2"],
):
    "construct a file stream which contains a csv file with the provided row/columns"

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow([""] + feature_ids)
    idx_counter = 0
    if np.array(values).ndim == 1:
        for sample_id in sample_ids:
            row = [sample_id]
            for i in range(len(feature_ids)):
                row.append(values[idx_counter])
                idx_counter += 1
                if idx_counter == len(values):
                    idx_counter = 0
            w.writerow(row)
    else:
        for i, sample_id in enumerate(sample_ids):
            row = [sample_id]
            row.extend(values[i])
            w.writerow(row)

    result = BytesIO(buf.getvalue().encode("utf8"))
    assert result.tell() == 0
    return result


def tabular_csv_data_file(cols: List[str], row_values: List[List[Any]]):
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(cols)

    for row in row_values:
        w.writerow(row)

    result = BytesIO(buf.getvalue().encode("utf8"))
    assert result.tell() == 0
    return result


def feature_type_with_metadata(
    db: SessionWithUser,
    settings: config.Settings,
    name="New Feature Type",
    id_column="entrez_id",
    metadata_file: Optional[typing.BinaryIO] = None,
    metadata_df: Optional[pd.DataFrame] = None,
    taiga_id="test_taiga.1",
    annotation_type_mapping=None,
    id_mapping=None,
    properties_to_index=None,
    user: Optional[str] = None,
):

    if metadata_df is not None:
        # assert metadata_file is None
        metadata_file_obj = BytesIO(metadata_df.to_csv(index=False).encode("utf8"))
        assert metadata_file_obj.tell() == 0

        if annotation_type_mapping is None:
            annotation_type_mapping = AnnotationTypeMap(
                annotation_type_mapping={
                    col: AnnotationType.text for col in metadata_df.columns
                }
            )
    else:
        metadata_file_obj = metadata_file

    if user is None:
        user = settings.admin_users[0]
    assert isinstance(user, str)

    metadata_upload_file = create_upload_file(
        filename="feature_metadata_file",
        file=metadata_file_obj,
        content_type="text/csv",
    )

    if id_mapping is not None:
        id_mapping = IdMapping(
            reference_column_mappings=id_mapping.reference_column_mappings
        )

    r = types_api.add_feature_type(
        db=db,
        name=name,
        id_column=id_column,
        metadata_file=metadata_upload_file,
        taiga_id=taiga_id,
        annotation_type_mapping=annotation_type_mapping,
        id_mapping=id_mapping,
        properties_to_index=properties_to_index,
        settings=settings,
        user=user,
    )

    return r


def sample_type_with_metadata(
    db: SessionWithUser,
    settings: config.Settings,
    name="New Sample Type",
    id_column="depmap_id",
    metadata_file=_CallIfOmitted(tabular_csv_data_file),
    taiga_id="test_taiga.1",
    annotation_type_mapping=None,
    id_mapping=None,
    properties_to_index=None,
    user=_CallIfOmitted(lambda settings: settings.admin_users[0]),
):
    metadata_upload_file = create_upload_file(
        filename="sample_metadata_file", file=metadata_file, content_type="text/csv"
    )
    r = types_api.add_sample_type(
        db=db,
        name=name,
        id_column=id_column,
        metadata_file=metadata_upload_file,
        taiga_id=taiga_id,
        annotation_type_mapping=annotation_type_mapping,
        id_mapping=id_mapping,
        properties_to_index=properties_to_index,
        settings=settings,
        user=user,
    )

    return r


def tabular_dataset(
    db: SessionWithUser,
    settings: config.Settings,
    name=None,
    data_df=None,
    group_id=None,
    taiga_id=None,
    given_id=None,
    priority=None,
    data_type_=None,
    columns_metadata=None,
    dataset_metadata={},
    is_transient=False,
    index_type_name=None,
    user=None,
    short_name=None,
    description=None,
    version=None,
):

    if group_id is None:
        if is_transient:
            group_id = TRANSIENT_GROUP_ID
        else:
            group_id = PUBLIC_GROUP_ID
    if user is None:
        user = settings.admin_users[0]

    if data_df is None:
        data_df = pd.DataFrame({"label": ["X"]})
        columns_metadata = {
            "label": ColumnMetadata(units=None, col_type=AnnotationType.text)
        }

    assert index_type_name is not None
    # index_type = dimension_type_factory(
    #     db, settings, pd.DataFrame({"label": data_df["label"]})
    # )

    if name is None:
        name = unique_name("tabular_dataset")
    if data_type_ is None:
        new_data_type = data_type(db, unique_name("datatype"))
        data_type_ = new_data_type.data_type

    dataset_in = TabularDatasetIn(
        id=str(uuid.uuid4()),
        name=name,
        index_type_name=index_type_name,
        data_type=data_type_,
        is_transient=is_transient,
        group_id=group_id,
        given_id=given_id,
        priority=priority,
        taiga_id=taiga_id,
        dataset_metadata=dataset_metadata,
        dataset_md5=None,
    )

    assert columns_metadata is not None
    index_type = types_crud.get_dimension_type(db, index_type_name)
    assert index_type is not None

    added_dataset = add_tabular_dataset(
        db,
        user,
        dataset_in,
        data_df,
        columns_metadata,
        index_type,
        short_name=short_name,
        version=version,
        description=description,
    )

    return added_dataset


def matrix_dataset(
    db: SessionWithUser,
    settings: config.Settings,
    feature_type: Optional[str] = "generic",
    sample_type: str = "depmap_model",
    data_type: str = "User upload",
    data_file=_CallIfOmitted(continuous_matrix_csv_file),
    is_transient=False,
    given_id=None,
    group=None,
    value_type=ValueType.continuous,
    priority=None,
    taiga_id=None,
    allowed_values=None,
    user=_CallIfOmitted(lambda settings: settings.admin_users[0]),
    dataset_name=None,
) -> Union[Dataset, Any]:
    if dataset_name is None:
        dataset_name = unique_name("upload")
    data_upload_file = create_upload_file(
        filename=dataset_name,
        file=_handle_call_if_omitted(data_file),
        content_type="text/csv",
    )

    if group is None:
        if is_transient:
            group = TRANSIENT_GROUP_ID
        else:
            group = PUBLIC_GROUP_ID

    r = dataset_tasks.upload_dataset(
        db=db,
        settings=settings,
        name=dataset_name,
        units="units",
        feature_type=feature_type,
        sample_type=sample_type,
        data_type=data_type,
        data_file=data_upload_file,
        is_transient=is_transient,
        group_id=group,
        given_id=given_id,
        value_type=ValueType(value_type),
        priority=priority,
        taiga_id=taiga_id,
        allowed_values=allowed_values,
        user=_handle_call_if_omitted(user, settings),
        data_file_format="csv",
    )

    return dataset_crud.get_dataset(
        db=db, user=_handle_call_if_omitted(user, settings), dataset_id=r.datasetId
    )


def file_ids_and_md5_hash(client, file):
    tabular_file_ids = []
    chunk = file.readline()
    hasher = hashlib.md5(chunk)
    while chunk:
        response = client.post(
            "/uploads/file", files={"file": ("table", chunk, "text/csv")},
        )
        assert response.status_code == 200
        tabular_file_ids.append(response.json()["file_id"])
        chunk = file.readline()
        hasher.update(chunk)
    hash = hasher.hexdigest()
    return tabular_file_ids, hash
