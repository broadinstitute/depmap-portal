import collections
import logging
from typing import Optional

from depmap.cell_line.models import CellLine, CellLineAlias, Lineage
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeContext, SubtypeContextEntity
from depmap.dataset.models import TabularDataset
from loader.cell_line_loader import is_non_empty_string
from loader.dataset_loader.utils import add_tabular_dataset
import pandas as pd
from depmap.database import db


log = logging.getLogger(__name__)


def load_depmap_model_metadata(filename: str, taiga_id: Optional[str] = None):
    df = pd.read_csv(filename, encoding="ISO-8859-1")
    insert_cell_lines(df)
    if taiga_id is not None:
        add_tabular_dataset(
            name_enum=TabularDataset.TabularEnum.depmap_model.name, taiga_id=taiga_id
        )


from depmap.utilities.models import log_data_issue
from numpy import isnan


def insert_cell_lines(df):
    """
    Given a df with particular column names, parse data and update cell line if cell_line_name is already present, else insert
    Is a separate method so this is testable
    """

    for index, row in df.iterrows():
        model_id = row["model_id"]

        cell_line_name = row["ccle_name"]
        stripped_cell_line_name = row["stripped_cell_line_name"]

        catalog_number = row["catalog_number"]
        growth_pattern = row["growth_pattern"]

        # If this assertion gets hit, put back in the processing of merged cell lines.
        if type(cell_line_name) == str:
            assert "[MERGED_TO_" not in cell_line_name

        # hack: some cell line names are missing striped cell line name because these are internal and have no data.
        # We just want it for a display label and so if we don't have it, instead use the ccle name. Check for NaN because
        # that's how pandas represents missing values
        if not isinstance(stripped_cell_line_name, str) and isnan(
            stripped_cell_line_name
        ):
            stripped_cell_line_name = cell_line_name

        # switching to model.csv resulted in records which also are missing ccle_name. Drop these records
        if not is_non_empty_string(stripped_cell_line_name):
            log.warning(f"Missing display name for {model_id}")
            stripped_cell_line_name = model_id

        cell_line_aliases = []
        seen_aliases = []
        if (
            is_non_empty_string(row["ccle_name"])
            and row["ccle_name"] not in seen_aliases
        ):
            cell_line_aliases.append(CellLineAlias(alias=row["ccle_name"]))

        oncotree_lineage = row["oncotree_lineage"]
        # each cell line must have a level 1 lineage
        if not is_non_empty_string(oncotree_lineage):
            log.warning(
                "%s had no oncotree_lineage, setting to unknown", cell_line_name
            )
            oncotree_lineage = "unknown"

        oncotree_lineage = row["oncotree_lineage"]
        # each cell line must have a level 1 lineage
        if not is_non_empty_string(oncotree_lineage):
            log.warning(
                "%s had no oncotree_lineage, setting to unknown", cell_line_name
            )
            oncotree_lineage = "unknown"

        lineage_names = [
            (1, oncotree_lineage),
            (2, row["oncotree_primary_disease"]),
            (3, row["oncotree_subtype"]),
            # TODO: Lineage 4 seems to always be empty...
            # can probably delete this at some point
            (4, "",),
            (5, row.get("legacy_sub_subtype")),
            (6, row.get("legacy_molecular_subtype")),
        ]

        lineages = [
            Lineage(level=level, name=name)
            for level, name in lineage_names
            if is_non_empty_string(name)
        ]
        wtsi_master_cell_id = row["wtsi_master_cell_id"]
        cosmic_id = row["cosmic_id"]
        sanger_model_id = row["sanger_model_id"]

        oncotree_primary_disease = row["oncotree_primary_disease"]
        oncotree_subtype = row["oncotree_subtype"]
        primary_or_metastasis = row["primary_or_metastasis"]

        sex = row["sex"]
        growth_pattern = row["growth_pattern"]
        source_type = row["source_type"]
        rrid = None if row["rrid"] == "" else row["rrid"]
        image_filename = row["image_filename"]

        public_comments = row.get("public_comments", "")

        if DepmapModel.exists(cell_line_name):
            log_data_issue(
                "DepmapModel",
                "Duplicate models name",
                identifier=cell_line_name,
                id_type="CCLE_shname",
            )
        else:

            cell_line_obj = CellLine.get_by_depmap_id(model_id)

            if not cell_line_obj:
                raise Exception("All models should have a matching cell line!")

            cell_line = DepmapModel(
                cell_line=cell_line_obj,
                cell_line_name=cell_line_name,
                stripped_cell_line_name=stripped_cell_line_name,
                # TODO: cell_line_alias is already loaded in the cell_line_loader. Uncomment out this
                # once we switch completely to using DepmapModel.
                # cell_line_alias=cell_line_aliases,
                patient_id=row["patient_id"],
                model_id=model_id,
                depmap_model_type=row["depmap_model_type"],
                wtsi_master_cell_id=wtsi_master_cell_id,
                cosmic_id=cosmic_id,
                catalog_number=catalog_number,
                sanger_model_id=sanger_model_id,
                # TODO: oncotree_lineage is already loaded in the cell_line_loader. Uncomment out this
                # once we switch completely to using DepmapModel.
                # oncotree_lineage=lineages,
                oncotree_primary_disease=oncotree_primary_disease,
                oncotree_subtype=oncotree_subtype,
                oncotree_code=row["oncotree_code"],
                legacy_molecular_subtype=row["legacy_molecular_subtype"],
                patient_molecular_subtype=row["patient_molecular_subtype"],
                age=row["age"],
                age_category=row["age_category"],
                patient_race=row["patient_race"],
                primary_or_metastasis=primary_or_metastasis,
                sex=sex,
                sample_collection_site=row["sample_collection_site"],
                source_type=source_type,
                source_detail=row["source_detail"],
                treatment_status=row["treatment_status"],
                treatment_details=row["treatment_details"],
                tissue_origin=row["tissue_origin"],
                onboarded_media=row["onboarded_media"],
                formulation_id=row["formulation_id"],
                engineered_model=row["engineered_model"],
                ccle_name=row["ccle_name"],
                plate_coating=row["plate_coating"],
                model_derivation_material=row["model_derivation_material"],
                legacy_sub_subtype=row["legacy_sub_subtype"],
                rrid=rrid,
                image_filename=image_filename,
                public_comments=public_comments,
                growth_pattern=growth_pattern,
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
