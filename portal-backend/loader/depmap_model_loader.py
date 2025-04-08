import collections
import logging
from typing import Optional

from depmap.cell_line.models import CellLine
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeContext, SubtypeContextEntity
from depmap.dataset.models import TabularDataset
from loader.dataset_loader.utils import add_tabular_dataset
from depmap.utilities.models import log_data_issue
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


def insert_cell_lines(df):
    """
    Is a separate method so this is testable
    """

    for index, row in df.iterrows():
        model_id = row["ModelID"]

        stripped_cell_line_name = row["StrippedCellLineName"]

        cell_line = CellLine.get_by_depmap_id(model_id)

        cell_line_name = row["CellLineName"]
        oncotree_primary_disease = _coerce_na(row["OncotreePrimaryDisease"])
        oncotree_subtype = _coerce_na(row["OncotreeSubtype"])
        oncotree_code = _coerce_na(row["OncotreeCode"])
        image_filename = _coerce_na(row["ImageFilename"])
        public_comments = _coerce_na(row["PublicComments"])
        age_category = _coerce_na(row["AgeCategory"])
        ccle_name = _coerce_na(row["CCLEName"])
        patient_id = _coerce_na(row["PatientID"])

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
            patient_id=patient_id,
            json_encoded_metadata=json_encoded_metadata,
        )

        db.session.add(cell_line)


def load_subtype_contexts(subtype_context_file_path, must=True):
    """
    First get a dict of for every subtype context, all the depmap models in it
    """
    models_per_context = get_depmap_models_in_subtype_context(
        subtype_context_file_path, must
    )
    for subtype_code, models in models_per_context.items():
        if len(models) == 0:
            continue
        db.session.add(
            SubtypeContextEntity(
                label=subtype_code,  # this is duplicated, but not sure how to do otherwise
                subtype_context=SubtypeContext(
                    subtype_code=subtype_code, depmap_model=models
                ),
            )
        )


def get_depmap_models_in_subtype_context(subtype_context_file_path, must=True):
    """
    :param subtype_context_file_path: path to context boolean matrix csv
    :return: list of Subtype Context objects of which the cell line is a member of 
    """
    print("loading subtype_context_file_path", subtype_context_file_path)
    models_lines_per_subtype_context = collections.defaultdict(lambda: [])
    skipped_missing_depmap_model = 0

    df = pd.read_csv(
        subtype_context_file_path, index_col=0
    )  # pandas is ok with duplicate index names

    indices_to_drop = df.index.duplicated(
        keep="first"
    )  # this has to be a positional true/false array, not the names of the indices. using df.drop(names of index) will all models with that name
    dropped_models = df[indices_to_drop].index.tolist()
    print(
        "Dropping the following cell lines; they have duplicates in the context matrix: \n{}".format(
            dropped_models
        )
    )
    for model_id in dropped_models:
        log_data_issue(
            "SubtypeContext",
            "Duplicate cell line name",
            identifier=model_id,
            id_type="model_id",
        )
    df = df[~indices_to_drop]

    depmap_models = df.index.values

    for subtype_code in df.columns:
        context_cell_lines = []

        for model_id in depmap_models[df[subtype_code] == 1]:
            cl = DepmapModel.get_by_model_id(model_id, must=must)
            if cl is None:
                skipped_missing_depmap_model += 1
                log_data_issue(
                    "SubtypeContext",
                    "Missing model from subtype context {}".format(subtype_code),
                    identifier=model_id,
                    id_type="model_id",
                )
            else:
                context_cell_lines.append(cl)

        models_lines_per_subtype_context[subtype_code] = context_cell_lines

    if skipped_missing_depmap_model > 0:
        log.warning(
            "Skipped %s models which were referenced by subtype contexts, but could not find name",
            skipped_missing_depmap_model,
        )

    assert len(models_lines_per_subtype_context) > 0
    return models_lines_per_subtype_context
