import logging
from typing import Optional

from depmap.cell_line.models import CellLine
from depmap.cell_line.models_new import DepmapModel
from depmap.dataset.models import TabularDataset
from loader.dataset_loader.utils import add_tabular_dataset
import pandas as pd
from depmap.database import db
import json

log = logging.getLogger(__name__)


def load_depmap_model_metadata(filename: str, taiga_id: Optional[str] = None):
    df = pd.read_csv(filename, encoding="ISO-8859-1").convert_dtypes()
    insert_cell_lines(df)
    if taiga_id is not None:
        add_tabular_dataset(
            name_enum=TabularDataset.TabularEnum.depmap_model.name, taiga_id=taiga_id
        )


def _coerce_na(value):
    if pd.isna(value):
        return None
    else:
        return value


def temp_cell_line_name_fixup(model_id, cell_line_name):
    if model_id == "ACH-000010":
        log.warning(
            "Nulling out cell line name from ACH-000010 because labeled as having the same name as ACH-000015. In the next release, we'll fix the dataset and then we can remove this hack"
        )
        cell_line_name = None

    return cell_line_name


def insert_cell_lines(df):
    """
    Is a separate method so this is testable
    """

    for index, row in df.iterrows():
        model_id = row["ModelID"]

        stripped_cell_line_name = row["StrippedCellLineName"]

        cell_line = CellLine.get_by_depmap_id(model_id)

        cell_line_name = temp_cell_line_name_fixup(model_id, row["CellLineName"])
        oncotree_primary_disease = _coerce_na(row["OncotreePrimaryDisease"])
        oncotree_subtype = _coerce_na(row["OncotreeSubtype"])
        oncotree_code = _coerce_na(row["OncotreeCode"])
        image_filename = _coerce_na(row["ImageFilename"])
        public_comments = _coerce_na(row["PublicComments"])
        age_category = _coerce_na(row["AgeCategory"])
        ccle_name = _coerce_na(row["CCLEName"])

        json_encoded_metadata = json.dumps({k: _coerce_na(v) for k, v in row.items()})

        cell_line = DepmapModel(
            cell_line=cell_line,
            cell_line_name=cell_line_name,
            ccle_name=ccle_name,
            stripped_cell_line_name=stripped_cell_line_name,
            oncotree_primary_disease=oncotree_primary_disease,
            oncotree_subtype=oncotree_subtype,
            oncotree_code=oncotree_code,
            model_id=model_id,
            image_filename=image_filename,
            public_comments=public_comments,
            age_category=age_category,
            json_encoded_metadata=json_encoded_metadata,
        )

        db.session.add(cell_line)
