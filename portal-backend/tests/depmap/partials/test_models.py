import pandas as pd
from numpy import NaN

from depmap.cell_line.models import CellLine
from depmap.dataset.models import DependencyDataset
from depmap.partials.matrix.models import Matrix, CellLineSeries, ColMatrixIndex
from depmap.entity.models import Entity
from tests.factories import (
    GeneFactory,
    CellLineFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    CompoundExperimentFactory,
    CompoundDoseReplicateFactory,
)

from depmap.dataset.models import Dataset
from depmap.compound.models import Compound, CompoundExperiment


def test_get_entity_by_label(empty_db_mock_downloads):
    gene = GeneFactory()
    matrix = MatrixFactory(entities=[gene])
    empty_db_mock_downloads.session.flush()

    assert matrix.get_entity_by_label(gene.label) == gene


def test_get_cell_lines(test_matrix):
    cell_lines = Matrix.query.get(1).get_cell_line_values_and_depmap_ids(
        "SWI5", by_label=True
    )

    data = [
        1.0,
        31.0,
        46.0,
        61.0,
        76.0,
        91.0,
        106.0,
        121.0,
        136.0,
        151.0,
        166.0,
        181.0,
        196.0,
        211.0,
        226.0,
        241.0,
        256.0,
        271.0,
    ]
    depmap_ids = [
        "ACH-000014",
        "ACH-000279",
        "ACH-000552",
        "ACH-000788",
        "ACH-000580",
        "ACH-001001",
        "ACH-000210",
        "ACH-000458",
        "ACH-000805",
        "ACH-000706",
        "ACH-000585",
        "ACH-000425",
        "ACH-000810",
        "ACH-000899",
        "ACH-001170",
        "ACH-001205",
        "ACH-000304",
        "ACH-000441",
    ]

    expected_cell_line_objects = [
        CellLine.get_by_depmap_id(depmap_id) for depmap_id in depmap_ids
    ]
    expected_zipped_cell_line_value = zip(expected_cell_line_objects, data)
    expected_series = pd.Series(data, index=depmap_ids)
    assert isinstance(cell_lines, CellLineSeries)
    # original series still equal, calling by_primary_site does not modify
    assert cell_lines.equals(expected_series)
    # list of cell_line objects
    assert cell_lines.cell_lines == expected_cell_line_objects

    # cell_line object, value tuples. zipped lists are iterators, can't just equate them
    for observed, expected in zip(
        cell_lines.zipped_cell_line_value, expected_zipped_cell_line_value
    ):
        assert observed[0] == expected[0]
        assert observed[1] == expected[1]


def test_get_series_by_entity_drops_na(empty_db_mock_downloads):
    """
    Test that the NAs are dropped
    """
    cell_line_1_nan = CellLineFactory(cell_line_name="cell_line_1_nan")
    cell_line_2 = CellLineFactory(cell_line_name="cell_line_2")
    entity = GeneFactory()
    cell_line_objs = [cell_line_1_nan, cell_line_2]

    dep_df = pd.DataFrame(
        {cell_line_1_nan.cell_line_name: [NaN], cell_line_2.cell_line_name: [2]},
        index=[entity.label],
    )
    dep_matrix = MatrixFactory(
        entities=[entity], cell_lines=cell_line_objs, data=dep_df.values
    )
    dataset = DependencyDatasetFactory(matrix=dep_matrix)
    empty_db_mock_downloads.session.flush()

    assert DependencyDataset.has_cell_line(dataset.name.name, cell_line_1_nan.depmap_id)

    col_index_cell_line_tuples = (
        dep_matrix.col_index.join(CellLine)
        .order_by(ColMatrixIndex.index)
        .with_entities(ColMatrixIndex.index, CellLine.cell_line_name)
        .all()
    )

    series = dep_matrix._get_series_by_entity(
        entity.entity_id, col_index_cell_line_tuples
    )
    cell_lines = series.index.tolist()

    assert (
        cell_line_2.cell_line_name in cell_lines
    )  # just to make sure cell_lines is as we expect
    assert cell_line_1_nan.cell_line_name not in cell_lines


def test_get_values_by_entities_and_depmap_id(empty_db_mock_downloads):
    cell_line = CellLineFactory(cell_line_name="CAS1_CENTRAL_NERVOUS_SYSTEM")
    compound_label = "CTRP:23256"
    xref_type = CompoundExperiment.split_xref_type_and_xref(compound_label)[0]
    xref = CompoundExperiment.split_xref_type_and_xref(compound_label)[1]

    expected_viabilities = list(range(0, 6))

    # create necessary compound experiment
    compound_experiment = CompoundExperimentFactory(
        xref_type=xref_type, xref=xref, label=compound_label
    )

    # create CompoundDoseReplicates
    compound_dose_replicates = []
    for dose in list(range(0, 3)):
        for replicate in list(range(0, 2)):
            compound_dose_replicates.append(
                CompoundDoseReplicateFactory(
                    compound_experiment=compound_experiment,
                    dose=dose,
                    replicate=replicate,
                )
            )

    gene = GeneFactory()
    matrix = MatrixFactory(
        entities=compound_dose_replicates,
        cell_lines=[cell_line],
        data=[
            [expected_viabilities[0]],
            [expected_viabilities[1]],
            [expected_viabilities[2]],
            [expected_viabilities[3]],
            [expected_viabilities[4]],
            [expected_viabilities[5]],
        ],
    )

    empty_db_mock_downloads.session.flush()

    viabilities = matrix.get_values_by_entities_and_depmap_id(
        entities=compound_dose_replicates, depmap_id=cell_line.depmap_id
    )

    assert viabilities == expected_viabilities
