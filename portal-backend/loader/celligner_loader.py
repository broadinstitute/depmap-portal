"""Methods to download and transform Celligner data"""
import os
import shutil

import pandas as pd
from flask import current_app

from depmap.cell_line.models import CellLine
from depmap.celligner.models import (
    CellignerDistanceColIndex,
    CellignerDistanceRowIndex,
    CellignerEntryEnum,
)
from depmap.celligner.utils import (
    ALIGNMENT_FILE,
    DIR,
    DISTANCES_FILE,
    DISTANCES_FILE_FOR_DOWNLOAD,
    SUBTYPES_FILE,
)
from depmap.database import db
from depmap.taiga_id import utils as taiga_utils
from depmap.utilities import hdf5_utils
from depmap.utilities.models import log_data_issue


def _get_cell_line_display_name_for_row(row):
    """Return cell_line_display_name if it exists for row in Celligner alignment"""
    # if row["type"] != CellignerEntryEnum.DEPMAP_MODEL.value:
    #     return row["sampleId"]
    cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(row["sampleId"])
    if cell_line is not None:
        return cell_line.cell_line_display_name
    return row["sampleId"]


def _get_cell_line_has_page(row):
    # if row["type"] != CellignerEntryEnum.DEPMAP_MODEL.value:
    #     return False
    cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(row["sampleId"])
    if cell_line is not None:
        return True
    return False


def _write_celligner_alignment(celligner_data: pd.DataFrame):
    """Download and save Celligner alignment"""

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, ALIGNMENT_FILE)
    celligner_data.to_csv(path)


def _write_subtypes(df):
    # get all the unique combinations of lineage and subtype
    subtypes = df[["lineage", "subtype"]].drop_duplicates().copy()
    subtypes["priority"] = 2

    # now also add in a subtype labeled "all" for each lineage
    subtypes = pd.concat(
        [
            subtypes,
            pd.DataFrame(
                dict(lineage=df["lineage"].unique(), subtype="all", priority=1)
            ),
        ]
    )

    # drop any rows for which subtype is blank
    subtypes = subtypes[~pd.isna(subtypes["subtype"])]

    # now make "all" appear at the start of each lineage
    subtypes.sort_values(["lineage", "priority", "subtype"])

    # and write out the dataframe without the priority column
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, SUBTYPES_FILE)
    subtypes[["lineage", "subtype"]].to_csv(path, index=False)


def _write_distances(distance_csv_file):
    df = pd.read_csv(distance_csv_file, index_col=0)

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, DIR, DISTANCES_FILE)
    hdf5_utils.df_to_hdf5(df, path)

    df.to_csv(os.path.join(source_dir, DIR, DISTANCES_FILE_FOR_DOWNLOAD))

    tumor_index_objects = [
        CellignerDistanceRowIndex(tumor_sample_id=tumor, index=i)
        for i, tumor in enumerate(df.index)
    ]
    db.session.bulk_save_objects(tumor_index_objects)

    profile_index_objects = [
        CellignerDistanceColIndex(profile_id=profile, index=i)
        for i, profile in enumerate(df.columns)
    ]
    db.session.bulk_save_objects(profile_index_objects)


def load_celligner_sample_data():
    alignment_file = os.path.join("sample_data", "celligner", "alignment.csv")
    distances_file = os.path.join("sample_data", "celligner", "distances.csv")
    load_celligner_data(alignment_file, distances_file)


def load_celligner_data(celligner_filename, distances_filename):
    celligner_data = pd.read_csv(celligner_filename, index_col=[0])
    celligner_data = celligner_data.reset_index()

    celligner_data = celligner_data.rename(
        columns={
            "PrimaryOrMetastasis": "primaryMet",
            "GrowthPattern": "growthPattern",
            "index": "profileId",
            "ModelConditionID": "modelConditionId",
            "ModelID": "sampleId",
        }
    )

    celligner_data["sampleId"].fillna(celligner_data["profileId"], inplace=True)

    celligner_data["type"] = celligner_data["type"].replace(
        {
            "TCGA+ tumor": "tcgaplus-tumor",
            "DepMap Model": "depmap-model",
            "MET500 tumor": "met500-tumor",
            "Novartis_PDX": "novartisPDX-model",
            "Pediatric_PDX": "pediatricPDX-model",
        }
    )

    import pandera as pa

    schema = pa.DataFrameSchema(
        columns={
            "profileId": pa.Column(str),
            "sampleId": pa.Column(str),
            "modelConditionId": pa.Column(str, nullable=True),
            "umap1": pa.Column("float64"),
            "umap2": pa.Column("float64"),
            "lineage": pa.Column(str, nullable=True),
            "subtype": pa.Column(str, nullable=True),
            "primaryMet": pa.Column(str, nullable=True),
            "type": pa.Column(
                str,
                checks=pa.Check.isin(
                    [
                        "tcgaplus-tumor",
                        "depmap-model",
                        "met500-tumor",
                        "novartisPDX-model",
                        "pediatricPDX-model",
                    ]
                ),
            ),
            "growthPattern": pa.Column(str, nullable=True),
            "cluster": pa.Column(int),
        },
    )
    celligner_data = schema.validate(celligner_data)

    celligner_data["lineage"][pd.isna(celligner_data["lineage"])] = "unknown"
    celligner_data["growthPattern"][
        pd.isna(celligner_data["growthPattern"])
    ] = "unknown"

    celligner_data["modelLoaded"] = celligner_data.apply(
        _get_cell_line_has_page, axis=1
    )

    celligner_data["displayName"] = celligner_data.apply(
        _get_cell_line_display_name_for_row, axis=1
    )

    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    if not os.path.exists(os.path.join(source_dir, DIR)):
        os.makedirs(os.path.join(source_dir, DIR))

    _write_celligner_alignment(celligner_data)
    _write_subtypes(celligner_data)
    _write_distances(distances_filename)
