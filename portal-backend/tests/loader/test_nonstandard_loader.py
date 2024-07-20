import os
import pytest

from loader import nonstandard_loader, gene_loader
from depmap.database import transaction
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    RowNonstandardMatrix,
    ColNonstandardMatrix,
    NonstandardMatrixLoaderMetadata,
)
from depmap.gene.models import Gene
from depmap.entity.models import Entity
from tests.factories import NonstandardMatrixLoaderMetadataFactory, CellLineFactory
from depmap.access_control import PUBLIC_ACCESS_GROUP


def test_add_dataset_index(empty_db_mock_downloads):
    """
    Not using pytest parameterize cos expected outcomes are quite different
    Test:
    Without entity or enforce_entity_all_rows set, row is just added and row_index is just the row_name
    With entity, row_index is the entity_id
    With entity and row_name we cannot find the entity for, the row is not added
    With entity and enforce_entity_all_rows,  an error is throw if we cannot find and entity for the row

    In theory we should also test that col (and row) indices are actually added - though really it'd be a giant hole in the site that would error out extremely easily
    """
    col_arxspan = "ACH-111111"
    col_arxspan_cell_line_name = "cell_line_with_arxspan"
    col_invalid_arxspan = "ACH-000000"

    with transaction():
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        gene_loader.load_hgnc_genes(
            os.path.join(
                loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv"
            )
        )
        CellLineFactory(
            depmap_id=col_arxspan, cell_line_name=col_arxspan_cell_line_name
        )

    ## cols ##
    arxspan_cols = [col_arxspan, col_invalid_arxspan]
    row_names = ["row_name"]

    dataset_id = "arxspan_cols_one_valid_one_invalid"
    NonstandardMatrix._add_dataset_index(
        dataset_id,
        row_names,
        arxspan_cols,
        None,
        "user_upload",
        True,
        "fake_path",
        PUBLIC_ACCESS_GROUP,
    )
    col_indices = (
        NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id)
        .one()
        .col_index.all()
    )
    assert len(col_indices) == 1  # invalid one was dropped
    assert col_indices[0].depmap_id == col_arxspan

    row_in_hgnc = "BRAF (673)"
    row_in_hgnc_gene_symbol = "BRAF"
    row_not_in_hgnc = "MESDC1 (59274)"
    col_names = ["col_name"]

    ## rows ##
    dataset_id = "just_use_row_name"  # no enforce_entity_all_rows, so row_not_in_hgnc is just added
    NonstandardMatrix._add_dataset_index(
        dataset_id,
        [row_not_in_hgnc],
        col_names,
        None,
        "user_upload",
        False,
        "fake_path",
        PUBLIC_ACCESS_GROUP,
    )
    empty_db_mock_downloads.session.flush()
    row_index_name = (
        NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id)
        .one()
        .row_index.first()
        .row_name
    )
    assert row_index_name == row_not_in_hgnc

    dataset_id = (
        "look_up_entity"  # and store id, check that id is query-able afterwards
    )
    NonstandardMatrix._add_dataset_index(
        dataset_id,
        [row_in_hgnc],
        col_names,
        Gene,
        "user_upload",
        False,
        "fake_path",
        PUBLIC_ACCESS_GROUP,
        load_row_with_entity_func=nonstandard_loader.load_row_with_entity,
    )
    empty_db_mock_downloads.session.flush()
    entity_id = (
        NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id)
        .one()
        .row_index.first()
        .entity_id
    )
    assert Entity.query.get(entity_id).label == row_in_hgnc_gene_symbol

    dataset_id = (
        "attempt_look_up_nonexistent_entity"  # row_not_in_hgnc should just be skipped
    )
    NonstandardMatrix._add_dataset_index(
        dataset_id,
        [row_not_in_hgnc],
        col_names,
        Gene,
        "user_upload",
        False,
        "fake_path",
        PUBLIC_ACCESS_GROUP,
        load_row_with_entity_func=nonstandard_loader.load_row_with_entity,
    )
    empty_db_mock_downloads.session.flush()
    assert (
        len(
            NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id)
            .one()
            .row_index.all()
        )
        == 0
    )

    dataset_id = "enforce_entity_all_rows_throws_error"  # attempt to add row_not_in_hgnc throws error
    with pytest.raises(AssertionError):
        NonstandardMatrix._add_dataset_index(
            dataset_id,
            [row_not_in_hgnc],
            col_names,
            Gene,
            "user_upload",
            False,
            "fake_path",
            PUBLIC_ACCESS_GROUP,
            enforce_entity_all_rows=True,
            load_row_with_entity_func=nonstandard_loader.load_row_with_entity,
        )


def test_delete_cache_if_invalid_exists(empty_db_mock_downloads):
    """
    Test
        does not error if provided a dataset id that does not exist
        does not delete if transpose matches
        deletes if transpose matches
    """

    def assert_expected_initial():
        assert NonstandardMatrix.query.count() == 1
        assert RowNonstandardMatrix.query.count() == 2
        assert ColNonstandardMatrix.query.count() == 2
        assert NonstandardMatrixLoaderMetadata.query.count() == 1

    cell_line_1 = CellLineFactory(cell_line_name="name_1")
    cell_line_2 = CellLineFactory(cell_line_name="name_2")
    col_names = [cell_line_1.cell_line_name, cell_line_2.cell_line_name]
    row_names = ["row_name_1", "row_name_2"]
    dataset_id = "test_id"
    NonstandardMatrix._add_dataset_index(
        dataset_id,
        row_names,
        col_names,
        None,
        "user_upload",
        False,
        "fake_path",
        PUBLIC_ACCESS_GROUP,
    )
    NonstandardMatrixLoaderMetadataFactory(
        nonstandard_dataset_id=dataset_id, transpose=False
    )
    empty_db_mock_downloads.session.flush()
    assert_expected_initial()

    nonstandard_loader.delete_cache_if_invalid_exists(
        "nonexistent-dataset-id", {"transpose": True}
    )
    assert_expected_initial()

    nonstandard_loader.delete_cache_if_invalid_exists(dataset_id, {"transpose": False})
    assert_expected_initial()

    nonstandard_loader.delete_cache_if_invalid_exists(dataset_id, {"transpose": True})
    assert NonstandardMatrix.query.count() == 0
    assert RowNonstandardMatrix.query.count() == 0
    assert ColNonstandardMatrix.query.count() == 0
    assert NonstandardMatrixLoaderMetadata.query.count() == 0
