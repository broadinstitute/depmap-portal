import os
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeContext
from flask import current_app
from math import nan
from loader.depmap_model_loader import insert_cell_lines, load_subtype_contexts

import pandas as pd
import pytest

from loader.cell_line_loader import (
    insert_or_update_cell_lines,
    is_non_empty_string,
)
from depmap.cell_line.models import CellLine
from depmap.database import transaction
from tests.factories import (
    CellLineFactory,
    DepmapModelFactory,
    SubtypeContextFactory,
)
from tests.utilities.df_test_utils import load_sample_cell_lines


def test_alt_names_or_aliases(empty_db_mock_downloads):
    cell_line_1 = CellLineFactory(depmap_id="depmap_id_1")
    empty_db_mock_downloads.session.flush()

    # line_1 updated to have lineage test, no aliases, and new arxspan_id
    new_cell_line_data = {
        "ccle_name": ["line_1"],
        "full_cell_line_name": ["line-6000"],
        "display_name": ["line"],
        "aliases": ["abcd, xyz"],
        "alt_names": ["theanswertolife"],
        "catalog_number": [cell_line_1.catalog_number],
        "growth_pattern": [cell_line_1.growth_pattern],
        "lineage_1": ["test"],
        "lineage_2": [nan],
        "lineage_3": [nan],
        "lineage_4": [nan],
        "arxspan_id": ["depmap_id_1"],
        "wtsi_master_cell_id": [cell_line_1.wtsi_master_cell_id],
        "cosmic_id": [cell_line_1.cosmic_id],
        "cell_line_passport_id": [cell_line_1.cell_line_passport_id],
        "primary_disease_name": [cell_line_1.primary_disease.name],
        "subtype_name": [cell_line_1.disease_subtype.name],
        "tumor_type_name": [cell_line_1.tumor_type.name],
        "cclf_gender": ["new gender"],
        "original_source": ["new source"],
        "rrid": ["test rrid"],
        "image_filename": ["file.png"],
        "comments": "",
        "growth_pattern": "Adherent",
    }

    df = pd.DataFrame(new_cell_line_data)
    insert_or_update_cell_lines(df)

    # line 1 was updated, and context is fine
    cell_line_1 = CellLine.get_by_depmap_id("depmap_id_1")
    assert sorted([ali.alias for ali in cell_line_1.cell_line_alias]) == sorted(
        ["abcd", "xyz", "theanswertolife", "line_1", "line-6000"]
    )


def test_insert_or_update_cell_lines(empty_db_mock_downloads):
    """
    Test that
    New cell line is added
    Existing cell line is correctly updated and context is still intact
    Other cell line still exists (total 3 lines)
    """
    cell_line_1 = DepmapModelFactory(model_id="line_1")
    cell_line_2 = DepmapModelFactory(model_id="line_2")
    SubtypeContextFactory(
        subtype_code="test_context", depmap_model=[cell_line_1, cell_line_2]
    )
    empty_db_mock_downloads.session.flush()

    assert len(cell_line_1.cell_line.lineage.all()) == 1
    assert cell_line_1.cell_line_name != "name_1"

    # line_1 updated to have lineage test, no aliases, and new arxspan_id
    new_cell_line_data = {
        "ccle_name": ["name_1", "new_name", "merged_line"],
        "display_name": ["line", "new", nan],
        "aliases": ["abcd, xyz", "", nan],
        "lineage_1": ["test", "test", nan],
        "lineage_2": [nan, nan, nan],
        "lineage_3": [nan, nan, nan],
        "lineage_4": [nan, nan, nan],
        "arxspan_id": ["line_1", "new_line", nan],
        "alt_names": ["", "", nan],
        "wtsi_master_cell_id": [cell_line_1.cell_line.wtsi_master_cell_id, None, nan],
        "cosmic_id": [cell_line_1.cell_line.cosmic_id, None, nan],
        "cell_line_passport_id": ["SIDM1", "SIDM2", nan],
        "primary_disease_name": [
            cell_line_1.cell_line.primary_disease.name,
            "test",
            nan,
        ],
        "subtype_name": [cell_line_1.cell_line.disease_subtype.name, "test", nan],
        "tumor_type_name": [cell_line_1.cell_line.tumor_type.name, "test", nan],
        "cclf_gender": ["new gender", "test", nan],
        "original_source": ["new source", "test", nan],
        "rrid": ["test rrid", "test rrid", nan],
        "image_filename": ["", "", nan],
        "comments": "",
        "growth_pattern": "Adherent",
        "catalog_number": "2",
    }

    df = pd.DataFrame(new_cell_line_data)
    insert_or_update_cell_lines(df)

    # total 3 cell lines
    assert len(CellLine.all()) == 3

    # new cell line added
    new_line = CellLine.get_by_depmap_id("new_line")
    assert new_line.cell_line_name == "new_name"

    # line 1 was updated, and context is fine
    cell_line_1 = CellLine.get_by_depmap_id("line_1")
    assert len(cell_line_1.lineage.all()) == 1
    assert cell_line_1.lineage.all()[0].name == "test"
    # assert cell_line_1.cell_line_name == 'name_1'

    context = SubtypeContext.get_by_code("test_context")
    assert context is not None
    assert len(context.depmap_model) == 2

    assert cell_line_1.gender == "new gender"
    assert cell_line_1.source == "new source"
    assert new_line.gender == "test"

    assert new_line.catalog_number == "2"
    assert new_line.growth_pattern == "Adherent"

    assert sorted([ali.alias for ali in cell_line_1.cell_line_alias]) == sorted(
        ["abcd", "xyz", "name_1",]
    )


@pytest.mark.parametrize("lineage, expected", [(nan, False), ("", False), ("a", True)])
def test_is_non_empty_string(empty_db_mock_downloads, lineage, expected):
    assert is_non_empty_string(lineage) == expected


def test_get_models_in_context(empty_db_mock_downloads):
    with transaction():
        load_sample_cell_lines()
        context_file_path = os.path.join(
            empty_db_mock_downloads.app.config["LOADER_DATA_DIR"],
            "cell_line/subtype_contexts.csv",
        )
        load_subtype_contexts(context_file_path)

    bone_cell_lines = {
        DepmapModel.query.filter_by(model_id=model_id).one()
        for model_id in [
            "ACH-001001",
            "ACH-000210",
            "ACH-001205",
            "ACH-000052",
            "ACH-000279",
        ]
    }

    context = SubtypeContext.get_by_code("BONE")
    assert context is not None
    model_ids = [model.model_id for model in context.depmap_model]
    assert sorted(model_ids) == sorted([model.model_id for model in bone_cell_lines])


def test_load_context(empty_db_mock_downloads):
    """
    Test that after loading cell lines and context, can get
    The cell lines in a context
    The contexts a cell line is part of
    """
    with transaction():
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_sample_cell_lines()
        # this test relies on have duplicates in this context csv
        load_subtype_contexts(
            os.path.join(loader_data_dir, "cell_line/subtype_contexts.csv")
        )

    bone_context = SubtypeContext.query.filter_by(subtype_code="BONE").one()
    bone_cell_lines = [
        "ACH-001001",
        "ACH-000052",
        "ACH-000210",
        "ACH-000279",
        "ACH-001205",
    ]  # no duplicates

    assert sorted([model.model_id for model in bone_context.depmap_model]) == sorted(
        bone_cell_lines
    )

    cell_line_in_ALKHotspot_ES_and_bone = DepmapModel.query.filter_by(
        model_id="ACH-001205"
    ).one()

    ALKHotspot_ES_and_bone_contexts = {
        SubtypeContext.query.filter_by(subtype_code=code).one()
        for code in ["BONE", "ES", "ALKHotspot"]
    }
    assert (
        set(cell_line_in_ALKHotspot_ES_and_bone.subtype_context)
        == ALKHotspot_ES_and_bone_contexts
    )
