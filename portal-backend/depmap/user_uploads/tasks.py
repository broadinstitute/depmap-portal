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

import os
import pandas as pd
from math import isnan
from typing import Any, List, Dict, Optional
import celery
from flask import current_app, url_for

from breadbox_facade import BreadboxException

from depmap import data_access
from depmap.compute.celery import app
from depmap.cell_line.models import CellLine
from depmap.interactive.nonstandard.models import (
    CellLineNameType,
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
):
    update_state(task, state="PROGRESS")

    # Validate parameters
    if label is None:
        raise UserError("Invalid input: Display name cannot be empty")
    if units is None:
        raise UserError("Invalid input: Units cannot be empty")
    
    # Read and validate data from CSV, 
    # Ensure the dataframe is in the format Breadbox expects
    df = read_and_validate_csv_shape(csv_path, single_column, is_transpose)

    # In order to support legacy PRISM datasets which may be diplayed in the portal,
    # we still need to support uploads which are indexed by CCLE Name instead of depmap ID. 
    cell_line_name_type = get_cell_line_name_type(df, is_transpose)
    warnings = validate_df_indices(df, cell_line_name_type)
    if cell_line_name_type == CellLineNameType.ccle_name:
        df = map_ccle_index_to_depmap_id(df)

    try:
        bb_dataset_uuid, bb_warnings = data_access.add_matrix_dataset_to_breadbox(
            name=label,
            units=units,
            data_type="User upload",
            data_df=df,
            sample_type="depmap_model",
            feature_type=None,
            is_transient=True,
        )
        dataset_id = f"breadbox/{bb_dataset_uuid}"
        warnings.extend(bb_warnings)

    except BreadboxException as e:
        raise UserError(e)

    return {
        "datasetId": dataset_id,
        "warnings": warnings,
        "forwardingUrl": url_for(
            "data_explorer_2.view_data_explorer_2",
            # Data Explorer 2 links require an xFeature (it does not
            # support linking to a partially defined plot)
            xFeature=list(df.columns)[1],
            yFeature=list(df.columns)[1],
            xDataset=dataset_id,
            yDataset=dataset_id,
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
):
    return _upload_transient_csv(
        self, label, units, is_transpose, csv_path, single_column
    )


def read_and_validate_csv_shape(csv_path: str, single_column: bool = False, is_transpose = True):
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
    elif not is_transpose:
        # Breadbox uploads are transposed versions of the legacy datasets, so
        # When is_transpose=False in the portal-backend, we _do_ need to transpose the data for breadbox.
        df = df.transpose()

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


def get_matching_cell_line_entities(cell_line_name_type: CellLineNameType, cell_line_names: list[str]) -> list[CellLine]:
    return CellLine.query.filter(
        getattr(CellLine, cell_line_name_type.db_col_name).in_(cell_line_names)
    ).all()

    
def map_ccle_index_to_depmap_id(df: pd.DataFrame) -> pd.DataFrame:
    """
    Update the index to use depmap_ids instead of ccle_names.
    Drop any rows that don't have matching records in the database
    (we've already generated warnings about any rows were this is the case).
    """
    index_col_name = df.columns[0]

    # Load a mapping between the old index and the new
    cell_line_names = list(df[index_col_name])
    cell_lines = get_matching_cell_line_entities(CellLineNameType.ccle_name, cell_line_names)
    ccle_to_depmap_id_mapping = {cell_line.cell_line_name: cell_line.depmap_id for cell_line in cell_lines}

    # Overwrite the existing index column with the new values
    df[index_col_name] = df[index_col_name].map(ccle_to_depmap_id_mapping)
    # Drop any rows which don't exist in the mapping.
    df = df.dropna(subset=[index_col_name])
    return df


def validate_df_indices(
    df: pd.DataFrame, cell_line_name_type: CellLineNameType
) -> List[str]:
    """
    Validate that
        cell lines match
        no duplicate cell lines
        no duplicates in the non-cell line index
    :return: list of any warnings
    Most of the validations here are redundant now that we are uploading to breadbox.
    However, I am leaving them in place for now because they handle some of the complexity of
    validating matrices which are indexed by CCLE names instead of DepMap IDs.
    """
    cell_line_names = list(df[df.columns[0]])
    feature_index = df.columns.tolist()

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

    cell_lines = get_matching_cell_line_entities(cell_line_name_type, cell_line_names)

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
    Support uploads by depmap ID or CCLE Name. 
    Note, we do not currently support uploads by stripped cell line names.
    :param df: df where cols are cell lines
    """
    cell_line_names = df[df.columns[0]]

    assert all(
        [type(name) == str for name in cell_line_names]
    ), "The passed df should have had NaNs in the index filled in. {}".format(cell_line_names)
    nonempty_names = [name for name in cell_line_names if name != ""]

    if len(nonempty_names) == 0:
        raise UserError(
            "Invalid input: Cell line dimension ({}) is all empty".format(
                "rows" if is_transpose else "columns"
            )
        )

    first_cell_line_name = nonempty_names[0]
    if first_cell_line_name.startswith("ACH-"):
        return CellLineNameType.depmap_id
    else:
        return CellLineNameType.ccle_name

