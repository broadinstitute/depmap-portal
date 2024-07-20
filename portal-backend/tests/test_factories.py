import pytest
from tests.factories import (
    MatrixFactory,
    GeneFactory,
    CellLineFactory,
    ContextFactory,
    ContextEntityFactory,
)
import numpy as np

from depmap.database import db


def test_context_entity_factory(empty_db_mock_downloads):
    context = ContextFactory()
    context_entity_1 = ContextEntityFactory(context=context)
    context_entity_2 = ContextEntityFactory()

    empty_db_mock_downloads.session.flush()

    assert context_entity_1.label == context_entity_1.context.name
    assert context_entity_2.label == context_entity_2.context.name


@pytest.mark.parametrize(
    "specify_genes, specify_cell_lines, specify_data",
    [
        (False, False, False),
        (True, False, False),
        (False, True, False),
        (False, False, True),
        (True, True, False),
        (True, False, True),
        (False, True, True),
        (True, True, True),
    ],
)
def test_matrix_factory_options(
    empty_db_mock_downloads, specify_genes, specify_cell_lines, specify_data
):
    """
    Test that things will create a matrix without error in the various combinations.
    Test that we can retrieve values from the hdf5 file
    """
    kwargs = {}

    if specify_genes:
        kwargs["entities"] = [GeneFactory(label="NRAS"), GeneFactory(label="MSL2")]

    if specify_cell_lines:
        cell_line_1 = CellLineFactory(cell_line_name="A2058_SKIN")
        cell_line_2 = CellLineFactory(cell_line_name="143B_BONE")
        kwargs["cell_lines"] = [cell_line_1, cell_line_2]

    if specify_data:
        kwargs["data"] = np.array([[5, 5], [5, 5]])

    matrix = MatrixFactory(**kwargs)

    some_entity = matrix.row_index.first().entity

    cell_line_values = matrix.get_cell_line_values_and_depmap_ids(
        some_entity.entity_id
    )  # get from hdf5

    if specify_genes:
        assert some_entity.label in {"NRAS", "MSL2"}

    if specify_cell_lines:
        assert cell_line_1.depmap_id in cell_line_values.index

    if specify_data:
        assert cell_line_values.iloc[0] == 5
    else:
        assert cell_line_values.iloc[0] == 0


def test_matrix_factory_two_matrices(empty_db_mock_downloads):
    """
    Test that we can make two matrices with the same df row name etc
    Test that it will use the same entity and cell line object and not error out
    """
    genes = GeneFactory.create_batch(5)
    cell_lines = CellLineFactory.create_batch(5)

    matrix_1 = MatrixFactory(
        entities=genes, cell_lines=cell_lines, units="expression units"
    )
    matrix_2 = MatrixFactory(
        entities=genes, cell_lines=cell_lines, units="copy_number units"
    )

    db.session.flush()

    matrix_1_entity_ids = [row.entity.entity_id for row in matrix_1.row_index]
    matrix_2_entity_ids = [row.entity.entity_id for row in matrix_2.row_index]

    matrix_1_cell_line_names = [
        col.cell_line.cell_line_name for col in matrix_1.col_index
    ]
    matrix_2_cell_line_names = [
        col.cell_line.cell_line_name for col in matrix_2.col_index
    ]

    assert matrix_1_entity_ids == matrix_2_entity_ids
    assert matrix_1_cell_line_names == matrix_2_cell_line_names

    # no data was provided, the dummy data should be the same. This is just to verify that we can get from the hdf5
    assert matrix_1.get_cell_line_values_and_depmap_ids(genes[0].entity_id).equals(
        matrix_1.get_cell_line_values_and_depmap_ids(genes[0].entity_id)
    )
