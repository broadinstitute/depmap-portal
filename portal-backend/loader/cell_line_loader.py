import collections
import logging
import pandas as pd
import re
from depmap.database import db
from depmap.cell_line.models import (
    CellLine,
    CellLineAlias,
    Lineage,
    PrimaryDisease,
    DiseaseSubtype,
    TumorType,
)
from depmap.context.models import Context, ContextEntity


log = logging.getLogger(__name__)


def load_cell_lines_metadata(filename):
    df = pd.read_csv(filename, encoding="ISO-8859-1")
    insert_or_update_cell_lines(df)


from depmap.utilities.models import log_data_issue
from numpy import isnan


def insert_or_update_cell_lines(df):
    """
    Given a df with particular column names, parse data and update cell line if cell_line_name is already present, else insert
    Is a separate method so this is testable
    """
    # somehow the pipeline delivered this in mixed case. Should fix this upstream but this is
    # a backwards compatible workaround. Should fix it upstream ultimately.
    # we seem to have a dup wtsi_master_cell_id
    if "WTSI_Master_Cell_ID" in df.columns:
        del df["WTSI_Master_Cell_ID"]

    df.columns = [x.lower() for x in df.columns]
    assert "wtsi_master_cell_id" in df.columns
    # more strange column renames. Something is wrong with how we generated the 20q4 sample info file
    # but am trying to avoid reprocessing everything if possible. All this should get reverted once file
    # is sorted out.
    if "disease" in df.columns and "primary_disease_name" not in df.columns:
        df["primary_disease_name"] = df["disease"]
    if "disease_subtype" in df.columns and "subtype_name" not in df.columns:
        df["subtype_name"] = df["disease_subtype"]

    for index, row in df.iterrows():
        depmap_id = row["arxspan_id"]
        if is_empty_string(depmap_id):
            # if we don't have a depmap ID there's really nothing to do but drop this
            log.warning(f"Missing depmap_id for {row}!")
            continue

        cell_line_name = row["ccle_name"]
        cell_line_display_name = row["display_name"]

        catalog_number = row["catalog_number"]

        if type(cell_line_name) == str and "[MERGED_TO_" in cell_line_name:
            continue

        # hack: some cell line names are missing striped cell line name because these are internal and have no data.
        # We just want it for a display label and so if we don't have it, instead use the ccle name.
        if is_empty_string(cell_line_display_name):
            cell_line_display_name = cell_line_name

        if is_empty_string(cell_line_display_name):
            log.warning(f"Missing display name for {depmap_id}")
            cell_line_display_name = depmap_id

        aliases = set()
        if is_non_empty_string(row["aliases"]):
            aliases.update(row["aliases"].split(","))

        if is_non_empty_string(row["alt_names"]):
            aliases.update(row["alt_names"].split(","))

        for alt_name_column in ["ccle_name", "full_cell_line_name"]:
            alt_name_value = row.get(alt_name_column)
            if is_non_empty_string(alt_name_value):
                aliases.add(alt_name_value)

        # get rid of any extra space
        aliases = set([x.strip() for x in aliases])

        cell_line_aliases = [CellLineAlias(alias=alias) for alias in aliases]

        level_1_lineage = row["lineage_1"]
        # each cell line must have a level 1 lineage
        if not is_non_empty_string(level_1_lineage):
            log.warning("%s had no level 1 lineage, setting to unknown", cell_line_name)
            level_1_lineage = "unknown"

        lineage_names = [
            (1, level_1_lineage),
            (2, row["lineage_2"]),
            (3, row["lineage_3"]),
            (4, row["lineage_4"]),
            #            legacy_sub_subtype has been removed, so don't add it
            #            (5, row.get("legacy_sub_subtype")),
            (6, row.get("legacy_molecular_subtype")),
        ]
        lineages = [
            Lineage(level=level, name=name)
            for level, name in lineage_names
            if is_non_empty_string(name)
        ]
        wtsi_master_cell_id = row["wtsi_master_cell_id"]
        cosmic_id = row["cosmic_id"]
        cell_line_passport_id = row["cell_line_passport_id"]

        primary_disease_name = row["primary_disease_name"]
        subtype_name = row["subtype_name"]
        tumor_type_name = row["tumor_type_name"]

        gender = row["cclf_gender"]
        growth_pattern = row["growth_pattern"]
        source = row["original_source"]
        rrid = None if row["rrid"] == "" else row["rrid"]
        image_filename = row["image_filename"]

        comments = row.get("comments", "")

        # Create PrimaryDisease, based on the name, if it does not already exists
        primary_disease_obj = create_or_retrieve_a_class_object_by_name(
            name=primary_disease_name, targeted_class=PrimaryDisease
        )
        # Create or retrieves the Subtype
        subtype_obj = create_or_retrieve_disease_subtype(
            name=subtype_name, associated_primary_disease=primary_disease_obj
        )

        # Creates or retrieves the tumor_type
        if not pd.isnull(tumor_type_name):
            tumor_type_obj = create_or_retrieve_a_class_object_by_name(
                name=tumor_type_name, targeted_class=TumorType
            )
        else:
            tumor_type_obj = None

        if CellLine.exists(cell_line_name):
            log_data_issue(
                "CellLine",
                "Duplicate cell line name",
                identifier=cell_line_name,
                id_type="CCLE_shname",
            )
        else:
            if CellLine.exists_by_depmap_id(depmap_id):
                cell_line = CellLine.get_by_depmap_id(depmap_id, must=True)

                # this is required
                [db.session.delete(alias) for alias in cell_line.cell_line_alias]
                [db.session.delete(lineage) for lineage in cell_line.lineage]

                # any properties that should be updated need to be specified here
                # there was an attempt to use db.session.merge, but we want to preserve certain cell line relationships such as context that not loaded in this loader and would be overwritten by merge. Additionally, backrefs require figuring out cascades
                cell_line.cell_line_display_name = cell_line_display_name
                cell_line.cell_line_alias = cell_line_aliases
                cell_line.wtsi_master_cell_id = wtsi_master_cell_id
                cell_line.cosmic_id = cosmic_id
                cell_line.cell_line_passport_id = cell_line_passport_id
                cell_line.lineage = lineages
                cell_line.primary_disease = primary_disease_obj
                cell_line.disease_subtype = subtype_obj
                cell_line.tumor_type = tumor_type_obj

                cell_line.gender = gender
                cell_line.source = source
                cell_line.rrid = rrid
                cell_line.image_filename = image_filename
                cell_line.comments = comments

            else:
                cell_line = CellLine(
                    cell_line_name=cell_line_name,
                    cell_line_display_name=cell_line_display_name,
                    cell_line_alias=cell_line_aliases,
                    depmap_id=depmap_id,
                    wtsi_master_cell_id=wtsi_master_cell_id,
                    cosmic_id=cosmic_id,
                    catalog_number=catalog_number,
                    cell_line_passport_id=cell_line_passport_id,
                    lineage=lineages,
                    primary_disease=primary_disease_obj,
                    disease_subtype=subtype_obj,
                    tumor_type=tumor_type_obj,
                    gender=gender,
                    source=source,
                    rrid=rrid,
                    image_filename=image_filename,
                    comments=comments,
                    growth_pattern=growth_pattern,
                )

                db.session.add(cell_line)


def is_empty_string(s):
    return not is_non_empty_string(s)


def is_non_empty_string(row_lineage_value):
    """
    Used for:
     1. not creating a lineage object if the row data is empty
     2. enforcing that the level 1 lineage is valid (non-empty)
    """
    if row_lineage_value is None:
        return False
    elif isinstance(row_lineage_value, str):  # math.isnan test requires a numeric input
        return row_lineage_value != ""
    else:
        return not isnan(row_lineage_value)


def create_or_retrieve_a_class_object_by_name(name, targeted_class):
    """Creates a `targeted_class`, based on the name, if it does not already exists"""
    assert name

    if pd.isnull(name):
        name = "unknown"

    targeted_obj = (
        db.session.query(targeted_class)
        .filter(targeted_class.name == name)
        .one_or_none()
    )

    if not targeted_obj:
        targeted_obj = targeted_class(name=name)

    return targeted_obj


def create_or_retrieve_disease_subtype(name, associated_primary_disease=None):
    """Creates or retrieves a DiseaseSubtype object"""
    assert name

    if pd.isnull(name):
        return None

    subtype_obj = (
        db.session.query(DiseaseSubtype)
        .filter(DiseaseSubtype.name == name)
        .one_or_none()
    )

    if not subtype_obj:
        assert associated_primary_disease, "No primary disease for {}".format(name)
        subtype_obj = DiseaseSubtype(
            name=name, primary_disease=associated_primary_disease
        )

    return subtype_obj


def load_contexts(context_file_path, must=True):
    """
    First get a dict of for every context, all the cell lines in it
    """
    cell_lines_per_context = get_cell_lines_in_context(context_file_path, must=must)
    for name, cell_lines in cell_lines_per_context.items():
        db.session.add(
            ContextEntity(
                label=name,  # this is duplicated, but not sure how to do otherwise
                context=Context(name=name, cell_line=cell_lines),
            )
        )


def get_cell_lines_in_context(context_file_path, must=True):
    """
    :param context_file_path: path to context boolean matrix csv
    :return: list of Context objects of which the cell line is a member of 
    """
    print("loading context_file_path", context_file_path)
    cell_lines_per_context = collections.defaultdict(lambda: [])
    skipped_missing_cell_line = 0

    df = pd.read_csv(
        context_file_path, index_col=0
    )  # pandas is ok with duplicate index names
    # print("contexts", df, context_file_path)

    indices_to_drop = df.index.duplicated(
        keep="first"
    )  # this has to be a positional true/false array, not the names of the indices. using df.drop(names of index) will all cell lines with that name
    dropped_cell_lines = df[indices_to_drop].index.tolist()
    print(
        "Dropping the following cell lines; they have duplicates in the context matrix: \n{}".format(
            dropped_cell_lines
        )
    )
    for cell_line_name in dropped_cell_lines:
        log_data_issue(
            "Context",
            "Duplicate cell line name",
            identifier=cell_line_name,
            id_type="CCLE_name",
        )
    df = df[~indices_to_drop]

    cell_lines = df.index.values

    for context_name in df.columns:
        context_cell_lines = []

        for cl_name in cell_lines[df[context_name] == 1]:
            cl = CellLine.get_by_depmap_id(cl_name, must=must)
            if cl is None:
                skipped_missing_cell_line += 1
                log_data_issue(
                    "Context",
                    "Missing cell line from context {}".format(context_name),
                    identifier=cl_name,
                    id_type="cell_line_name",
                )
            else:
                context_cell_lines.append(cl)

        cell_lines_per_context[context_name] = context_cell_lines

    if skipped_missing_cell_line > 0:
        log.warning(
            "Skipped %s cell lines which were referenced by contexts, but could not find name",
            skipped_missing_cell_line,
        )

    assert len(cell_lines_per_context) > 0
    return cell_lines_per_context
