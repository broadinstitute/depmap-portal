"""
This file contains the entry functions run by celery workers for uploading datasets from users
They take in any input that the main depmap thread sends (usually from an endpoint in a views file)
    We want minimal processing by the main thread, so often this is just the user inputs sent from the UI
They return the dataset id of the uploaded dataset, as well as any warnings about the dataset
    E.g. a warning containing the cell lines that were not recognized

The only remaining entry point function here is
    upload_transient_csv

They are structured to be as similar as possible, to share as many of the same functions and have the same steps.

Some decisions about user upload datasets:
- errors with expected bad user input with be incremental. we will not collect all errors, instead we will just return the first error hit
- the feature name for a user uploaded dataset is always "feature"
"""

import uuid
import os
from depmap.enums import DataTypeEnum
import pandas as pd
from math import isnan
from typing import Any, List, Dict, Optional
import celery
from flask import current_app, url_for

from depmap import data_access
from depmap.compute.celery import app
from depmap.cell_line.models import CellLine
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    CellLineNameType,
    CustomDatasetConfig,
)
from depmap.utilities import hdf5_utils
from depmap.utilities.hashing_utils import hash_df
from depmap.utilities.exception import UserError
from depmap.user_uploads.utils import (
    get_task,
)
from depmap.access_control import (
    PUBLIC_ACCESS_GROUP,
)


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


def _upload_transient_csv(
    task: celery.Task,
    label: str,
    units: str,
    is_transpose: bool,
    csv_path: str,
    single_column: bool,
    use_data_explorer_2: bool, # now ignored, TODO: remove
):
    update_state(task, state="PROGRESS")

    # Validate parameters
    if label is None:
        raise UserError("Invalid input: Display name cannot be empty")
    if units is None:
        raise UserError("Invalid input: Units cannot be empty")
    
    # update state to checking file...
    df = read_and_validate_csv_shape(csv_path, single_column)

    dataset_uuid = data_access.add_matrix_dataset_to_breadbox(
        name=label,
        units=units,
        data_type="User upload",
        data_df=df,
        sample_type="depmap_model",
        feature_type=None,
        is_transient=True,
    )

    # TODO: The above should be fine now, just remove some of this older code below that's no longer needed
    cell_line_name_type = get_cell_line_name_type(df, is_transpose)

    # update state to validating cell lines...
    warnings = validate_cell_lines_and_register_as_nonstandard_matrix(
        df, dataset_uuid, cell_line_name_type, config, PUBLIC_ACCESS_GROUP
    )

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


def read_and_validate_csv_shape(csv_path: str, single_column: bool = False):
    """
    Read the CSV from file. If the CSV is expected to be a single column, 
    validate that is actually the case.
    """
    assert isinstance(csv_path, str)
    # assert os.path.exists(csv_path)

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

    # reset the index because breadbox expects the first column to contain the sample IDs
    df = df.reset_index()

    return df


def convert_to_empty_string_if_nan(x):
    if type(x) == str:
        return x
    elif isnan(x):
        return ""
    else:
        return x


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
    # TODO: determine if this is still necessary
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
