"""
This file contains the entry functions run by celery workers for uploading datasets from users
They take in any input that the main depmap thread sends (usually from an endpoint in a views file)
    We want minimal processing by the main thread, so often this is just the user inputs sent from the UI
They return the dataset id of the uploaded dataset, as well as any warnings about the dataset
    E.g. a warning containing the cell lines that were not recognized

The three entry point functions here are
    upload_private
    upload_transient_csv
    upload_transient_taiga

They are structured to be as similar as possible, to share as many of the same functions and have the same steps.

Some decisions about user upload datasets:
- errors with expected bad user input with be incremental. we will not collect all errors, instead we will just return the first error hit
- the feature name for a user uploaded dataset is always "feature"
"""

import uuid
import os
import io
import datetime
from depmap.enums import DataTypeEnum
import pandas as pd
from math import isnan
from typing import Any, List, Dict, Optional
from werkzeug import FileStorage
from werkzeug.utils import secure_filename
import celery
from flask import current_app, url_for
from depmap.compute.celery import app
from depmap.cell_line.models import CellLine
from depmap.taiga_id.utils import get_taiga_client, get_taiga_id_parts
from depmap.interactive.nonstandard import nonstandard_utils
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    CellLineNameType,
    CustomDatasetConfig,
    PrivateDatasetMetadata,
)
from depmap.utilities import hdf5_utils
from depmap.utilities.hashing_utils import hash_df
from depmap.utilities.exception import UserError
from depmap.user_uploads.utils import (
    get_task,
    get_user_upload_records,
    update_user_upload_records,
    write_user_upload_file,
    UserUploadRecord,
)
from depmap.access_control import (
    assume_user,
    get_visible_owner_id_configs,
    is_current_user_an_admin,
    PUBLIC_ACCESS_GROUP,
)
from loader.taiga_id_loader import _ensure_canonical_id_stored


def update_state(
    task: celery.Task, state=None, message: Optional[str] = None,
):
    if task is None:
        return
    if state is None and task.request is not None:
        task_result = get_task(task.request.id)
        state = task_result.state

    meta: Dict[str, Any] = {}
    if message is not None:
        meta["message"] = message

    task.update_state(state=state, meta=meta)


@app.task(bind=True)
def upload_private(
    self: celery.Task,
    label: str,
    units: str,
    csv_path: str,
    data_file_name: str,
    content_type: str,
    is_transpose: bool,
    user_id: str,
    group_id: int,
    data_type_for_upload: Optional[str] = DataTypeEnum.user_upload.name,
):
    update_state(self, state="PROGRESS")
    with assume_user(user_id):
        # check that user belongs to group
        update_state(self, message="Validating dataset settings")
        validate_private_metadata(group_id)
        validate_common_metadata(label, units)

        update_state(self, message="Validating dataset format")
        df = validate_csv_format(csv_path)

        dataset_uuid = str(uuid.uuid4())
        cell_line_name_type = get_cell_line_name_type(df, is_transpose)
        config = format_config(
            label, units, is_transpose, data_type=data_type_for_upload
        )
        # update state to validating cell lines...

        # saying validating cell lines, because it seems a little strange to say "adding to the portal" here, then saving to cloud storage later
        update_state(self, message="Validating cell lines")
        # this loading of nonstandard matrix HAS to come after private metadata has been validated aka group access has been validated
        # we also decided that we do not want to mutate the dataframe
        warnings = validate_cell_lines_and_register_as_nonstandard_matrix(
            df, dataset_uuid, cell_line_name_type, config, group_id
        )

        update_state(self, message="Saving file to cloud storage")
        # fixme this FileStorage construction is a hack, to just put things in a format that the existing private code wnats
        with open(csv_path, "rb") as data_file_fd:
            add_private_config_and_upload_to_bucket(
                data_file_fd,
                data_file_name,
                content_type,
                dataset_uuid,
                cell_line_name_type,
                config,
                group_id,
            )
        return {
            "datasetId": dataset_uuid,
            "warnings": warnings,
            "forwardingUrl": url_for(
                "data_explorer_2.view_data_explorer_2",
                # Data Explorer 2 links require an xFeature (it does not
                # support linking to a partially defined plot)
                xFeature=nonstandard_utils.get_random_row_name(dataset_uuid),
                xDataset=dataset_uuid,
            ),
        }  # fixme, this is not the actual contract. return warnings and what??


# Split out from task because we also use it in the loader
def _upload_transient_csv(
    task: celery.Task,
    label: str,
    units: str,
    is_transpose: bool,
    csv_path: str,
    single_column: bool,
    use_data_explorer_2: bool,
):
    update_state(task, state="PROGRESS")
    validate_common_metadata(label, units)
    # update state to checking file...
    df = validate_csv_format(csv_path, single_column)

    dataset_uuid = str(uuid.uuid4())
    config = format_config(label, units, is_transpose)
    cell_line_name_type = get_cell_line_name_type(df, is_transpose)

    # update state to validating cell lines...
    warnings = validate_cell_lines_and_register_as_nonstandard_matrix(
        df, dataset_uuid, cell_line_name_type, config, PUBLIC_ACCESS_GROUP
    )
    add_transient_config(dataset_uuid, config)
    node_id = "custom_dataset/{}".format(dataset_uuid)

    if use_data_explorer_2:
        return {
            "datasetId": dataset_uuid,
            "warnings": warnings,
            "forwardingUrl": url_for(
                "data_explorer_2.view_data_explorer_2",
                # Data Explorer 2 links require an xFeature (it does not
                # support linking to a partially defined plot)
                xFeature=list(df.columns)[0],
                yFeature=list(df.columns)[0],
                xDataset=dataset_uuid,
                yDataset=dataset_uuid,
            ),
        }

    return {
        "datasetId": dataset_uuid,
        "warnings": warnings,
        "forwardingUrl": url_for(
            "interactive.view_interactive",
            x=node_id,
            y=node_id,
            defaultCustomAnalysisToX=True,
        ),
    }


@app.task(bind=True)
def upload_transient_csv(
    self: celery.Task,
    label: str,
    units: str,
    is_transpose: bool,
    csv_path: str,
    single_column: bool,
    use_data_explorer_2: bool = False,
):
    return _upload_transient_csv(
        self, label, units, is_transpose, csv_path, single_column, use_data_explorer_2
    )


@app.task(bind=True)
def upload_transient_taiga(
    self: celery.Task, label: str, units: str, is_transpose: bool, taiga_id: str,
):
    update_state(self, state="PROGRESS")
    # check that taiga id is valid
    validate_transient_taiga_metadata(taiga_id)
    validate_common_metadata(label, units)
    # update state to checking file...
    csv = download_transient_taiga(taiga_id)
    df = validate_csv_format(csv)

    dataset_uuid = str(uuid.uuid4())
    cell_line_name_type = get_cell_line_name_type(df, is_transpose)
    config = format_config_taiga(label, units, is_transpose, taiga_id)

    # update state to validating cell lines...
    warnings = validate_cell_lines_and_register_as_nonstandard_matrix(
        df, dataset_uuid, cell_line_name_type, config, PUBLIC_ACCESS_GROUP
    )
    add_transient_config(dataset_uuid, config)
    node_id = "custom_dataset/{}".format(dataset_uuid)
    return {
        "datasetId": dataset_uuid,
        "warnings": warnings,
        "forwardingUrl": url_for(
            "interactive.view_interactive",
            x=node_id,
            y=node_id,
            defaultCustomAnalysisToX=True,
        ),
    }


def validate_private_metadata(group_id):
    """
    Note: This needs to be called in the context of `with assume_user(user_id):`
    """
    visible_owner_ids = get_visible_owner_id_configs(write_access=True)
    if group_id not in visible_owner_ids.keys():
        raise UserError("Invalid input: You do not have access to this group")


def validate_transient_taiga_metadata(taiga_id: str):
    tc = get_taiga_client()

    dataset, version, _ = get_taiga_id_parts(taiga_id)
    dataset_and_version_metadata = tc.get_dataset_metadata(dataset, version)
    if dataset_and_version_metadata is None:
        raise UserError(f"Invalid input: No file found for Taiga ID {taiga_id}")

    dataset_metadata = dataset_and_version_metadata["dataset"]
    dataset_version_metadata = dataset_and_version_metadata["datasetVersion"]

    dv_status = dataset_version_metadata["state"]
    if dv_status != "approved":
        dv_name = f"{dataset_metadata['permanames'][-1]}.{dataset_version_metadata['version']}"
        raise UserError(f"The dataset version {dv_name} is {dv_status}")

    datafiles = dataset_version_metadata["datafiles"]

    if len(datafiles) == 1:
        datafile_metadata = datafiles[0]
    else:
        matching_datafiles = [
            f for f in datafiles if taiga_id.endswith(f"/{f['name']}")
        ]
        assert len(matching_datafiles) == 1
        datafile_metadata = matching_datafiles[0]

    if datafile_metadata.get("type") != "HDF5":
        raise UserError(f"Taiga datafile {taiga_id} is not a Matrix file")


def validate_common_metadata(label, units):
    if label is None:
        raise UserError("Invalid input: Display name cannot be empty")

    if units is None:
        raise UserError("Invalid input: Units cannot be empty")


def download_transient_taiga(taiga_id):
    # register the canonical taiga id in the TaigaAlias table
    # we can just promiscuously do so, it's fine to still have the row there if the custom dataset fails later
    _ensure_canonical_id_stored(taiga_id)
    source_file_path = get_taiga_client().download_to_cache(
        datafile_id=taiga_id,
        requested_format="csv_matrix"
        # we test validity with hdf5, but download as csv, so that we can go through the code for the usual validation.
        # then we will manually convert to hdf5 ourselves
    )
    return source_file_path


def validate_csv_format(csv_path: str, single_column: bool = False):
    assert isinstance(csv_path, str)
    assert os.path.exists(csv_path)

    try:
        df = pd.read_csv(csv_path, header=None if single_column else 0, index_col=0)
    except Exception as e:
        raise UserError(f"Cannot parse {csv_path} file as CSV: {e}")

    if single_column:
        if len(df.columns) != 1:
            raise UserError("File has too many columns")
        first_index = df.index[0]

        if pd.isnull(first_index) or first_index == "":
            raise UserError(
                "Index of first row is NaN. Please upload a file without a header.",
            )

        df.columns = ["custom data"]
        df.index.name = None

    try:
        # the df to hdf5 file storage converts it to a float
        # so we validate that first here
        df = df.astype(float)
    except Exception as e:
        raise UserError("Dataset has non-numeric values: {}".format(e))

    # fill in NaNs in the both the row index and column names with empty string
    df.index = [convert_to_empty_string_if_nan(x) for x in df.index]
    df.columns = [convert_to_empty_string_if_nan(x) for x in df.columns]

    return df


def convert_to_empty_string_if_nan(x):
    if type(x) == str:
        return x
    elif isnan(x):
        return ""
    else:
        return x


def format_config(label, units, is_transpose, data_type=DataTypeEnum.user_upload.name):
    """
    This function is used to format config for uploaded datasets
    """
    config = {
        "label": label,
        "units": units,
        "data_type": DataTypeEnum[data_type],
        "feature_name": "feature",
        "transpose": is_transpose,
        "is_standard": False,
    }
    return config


def format_config_taiga(label, units, is_transpose, taiga_id):
    config = format_config(label, units, is_transpose)
    config["taiga_id"] = taiga_id
    return config


def validate_cell_lines_and_register_as_nonstandard_matrix(
    df: pd.DataFrame,
    dataset_uuid: str,
    cell_line_name_type: CellLineNameType,
    config: Dict,
    owner_id: int,
):
    """
    aka, do common stuff in the second half
    """
    is_transpose = config["transpose"]
    warnings = validate_df_indices(df, is_transpose, cell_line_name_type)
    hdf5_file_name = convert_to_hdf5(df)

    assert (
        cell_line_name_type != CellLineNameType.display_name
    )  # we don't support that yet, it's currently user_arxspan_
    use_arxspan_id = cell_line_name_type == CellLineNameType.depmap_id

    # Not catching AllRowsOrColsSkipped here, because we don't expect it to happen. I suppose it could happen if the csv had no rows
    # Skipping all cols should be verified in validate df cell lines. And all rows should be accepted
    # Data access details should be in interactive config (including references to NonstandardMatrix)
    _, cols_skipped = NonstandardMatrix.read_file_and_add_dataset_index(
        dataset_id=dataset_uuid,
        config=config,
        file_path=hdf5_file_name,
        entity_class=None,
        use_arxspan_id=use_arxspan_id,
        owner_id=owner_id,
    )
    return warnings


def validate_df_indices(
    df, is_transpose, cell_line_name_type: CellLineNameType
) -> List[str]:
    """
    Validate that
        cell lines match
        no duplicate cell lines
        no duplicates in the non-cell line index
    :return: list of any warnings
    """
    if is_transpose:
        cell_line_names = df.index.tolist()
        feature_index = df.columns.tolist()
    else:
        cell_line_names = df.columns.tolist()
        feature_index = df.index.tolist()

    def count_duplicates(l):
        return [(l.count(x), x) for x in l]

    if len(cell_line_names) != len(set(cell_line_names)):
        raise UserError(
            "Cell lines must be unique. Duplicate cell lines found: {}".format(
                ", ".join(
                    [
                        "{} of {}".format(count, cell_line)
                        for count, cell_line in count_duplicates(cell_line_names)
                        if count > 1
                    ]
                )
            )
        )

    if len(feature_index) != len(set(feature_index)):
        raise UserError(
            "Indices must be unique. Duplicates found: {}".format(
                ", ".join(
                    [
                        "{} of {}".format(count, feature)
                        for count, feature in count_duplicates(feature_index)
                        if count > 1
                    ]
                )
            )
        )

    cell_lines: List[CellLine] = CellLine.query.filter(
        getattr(CellLine, cell_line_name_type.db_col_name).in_(cell_line_names)
    ).all()

    if len(cell_lines) == 0:
        raise UserError(
            "No matching cell lines found: {}".format(
                ", ".join(cell_line_names[:3])
                + ("..." if len(cell_line_names) > 3 else "")
            )
        )

    elif len(cell_lines) < len(cell_line_names):
        unknown_cell_lines = set(cell_line_names).difference(
            [
                getattr(cell_line, cell_line_name_type.db_col_name)
                for cell_line in cell_lines
            ]
        )
        return [
            "{} out of {} cell lines matched. Could not match: {}.".format(
                len(cell_lines), len(cell_line_names), ", ".join(unknown_cell_lines)
            )
        ]

    return []


def get_cell_line_name_type(df, is_transpose):
    """
    :param df: df where cols are cell lines
    """
    if is_transpose:
        cols = df.index
    else:
        cols = df.columns

    assert all(
        [type(col) == str for col in cols]
    ), "The passed df should have had NaNs in the index filled in. {}".format(cols)
    nonempty_cols = [col for col in cols if col != ""]

    if len(nonempty_cols) == 0:
        raise UserError(
            "Invalid input: Cell line dimension ({}) is all empty".format(
                "rows" if is_transpose else "columns"
            )
        )

    first_col_name = nonempty_cols[0]
    if first_col_name.startswith("ACH-"):
        return CellLineNameType.depmap_id
    else:
        return CellLineNameType.ccle_name

    # we don't yet support stripped cell line names
    # elif first_col_name.isupper() and '_' in first_col_name:
    #     return CellLineNameType.ccle_name
    # else:
    #     return CellLineNameType.display_name


def convert_to_hdf5(df):
    """
    :return: name of hdf5 in the nonstandard data dir directory, NOT the full path
    """
    source_dir = current_app.config["NONSTANDARD_DATA_DIR"]
    hash = hash_df(df)
    local_file_name = "{}.hdf5".format(hash)
    local_file_path = os.path.join(source_dir, local_file_name)

    if not os.path.exists(local_file_path):
        # If MatrixConversionException is thrown from this, it is not an expected error
        # we currently don't expect that a valid dataframe
        # we expect that every dataframe that has gone through the validation checks that we put in place (e.g. conversion to float)
        #   should be able to be converted to a hdf5
        # thus if there is indeed an error in running this, we let it be thrown as a hard error, so that we get stackdriver notified
        hdf5_utils.df_to_hdf5(df, local_file_path)

    return local_file_name


import typing


def add_private_config_and_upload_to_bucket(
    data_file: typing.IO,
    data_file_name: str,
    content_type: str,
    dataset_uuuid: str,
    cell_line_name_type,
    config,
    group_id,
):
    """
    Note: This needs to be called in the context of `with assume_user(user_id):`
    """
    data_file.seek(0)

    assert data_file_name is not None

    # update_state(message="Saving file to cloud storage", warnings=warnings)
    visible_owner_ids = get_visible_owner_id_configs()

    file_name = "{}_{}_{}.csv".format(
        visible_owner_ids[group_id].display_name,
        secure_filename(os.path.splitext(data_file_name)[0]),
        datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S"),
    )

    uploaded_path = write_user_upload_file(file_name, data_file, content_type)

    # add private dataset metadata row
    private_dataset = PrivateDatasetMetadata.add(
        uuid=dataset_uuuid,
        display_name=config["label"],
        units=config["units"],
        feature_name=config["feature_name"],
        is_transpose=config["transpose"],
        cell_line_name_type=cell_line_name_type,
        csv_path=uploaded_path,
        owner_id=group_id,
        data_type=config["data_type"].name,
        priority=None,
    )

    private_dataset_metadata_dict = private_dataset.to_dict()

    # add to private dataset map
    df = get_user_upload_records()

    df.append(UserUploadRecord(**private_dataset_metadata_dict))
    update_user_upload_records(df)

    # fixme do something better than passing data_file, modify load private dataset metadata to a function in the loader that just calls db add, without the csv download from bucket
    # and thus move this direct db access into a loader file


def add_transient_config(dataset_uuid, config):
    # Need to convert data_type to str to be able to serialize
    config["data_type"] = config["data_type"].name
    CustomDatasetConfig.add(dataset_uuid, config)
