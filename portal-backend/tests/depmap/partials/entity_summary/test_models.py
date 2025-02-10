from io import StringIO
from flask import url_for
from json import loads as json_loads
import pandas as pd
import numpy as np
import pytest

from depmap.dataset.models import DependencyDataset, BiomarkerDataset, Dataset
from depmap.gene.models import Gene
from depmap.partials.entity_summary import models
from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    CellLineFactory,
    LineageFactory,
    CompoundExperimentFactory,
)
from tests.utilities import interactive_test_utils
from tests.utilities.df_test_utils import dfs_equal_ignoring_column_order


@pytest.mark.parametrize(
    "entity_factory, dep_enum, has_line",
    [
        (GeneFactory, DependencyDataset.DependencyEnum.Avana, True),
        (GeneFactory, DependencyDataset.DependencyEnum.RNAi_Ach, True),
        (CompoundExperimentFactory, DependencyDataset.DependencyEnum.GDSC1_AUC, False),
    ],
)
def test_integrate_dep_data(
    empty_db_mock_downloads, entity_factory, dep_enum, has_line
):
    """
    Doesn't test context enrichment stuff 
    """
    cell_line_1 = CellLineFactory(cell_line_name="cell_line_1")
    cell_line_2 = CellLineFactory(cell_line_name="cell_line_2")
    entity = entity_factory()
    cell_line_objs = [cell_line_1, cell_line_2]

    dep_df = pd.DataFrame(
        {cell_line_1.cell_line_name: [1], cell_line_2.cell_line_name: [2]},
        index=[entity.label],
    )
    dep_matrix = MatrixFactory(
        entities=[entity], cell_lines=cell_line_objs, data=dep_df.values
    )
    dataset = DependencyDatasetFactory(matrix=dep_matrix, name=dep_enum)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected_srs = dataset.matrix.get_cell_line_values_and_depmap_ids(entity.entity_id)

    # Since compound datasets will be indexed by compound going forward, 
    # the integrate_dep_data function expects to be called by compound, even
    # when the underlying dataset is indexed by compound experiment.
    if entity.type == "compound_experiment":
        entity_label = entity.compound.label
    else:
        entity_label = entity.label

    feature_data_srs = models.get_feature_data(dep_enum.name, entity_label)
    metadata = models.get_entity_summary_metadata(dep_enum.name, feature_data_srs, entity_label)

    assert feature_data_srs.equals(expected_srs)

    assert "x_range" in metadata
    assert metadata["x_label"] == dataset.matrix.units
    assert "description" in metadata

    if has_line:
        assert "line" in metadata
    else:
        assert "line" not in metadata


def test_integrate_cell_line_information(empty_db_mock_downloads):
    """
    Test that
        The merge happens correctly, and drops the row where value is NaN
    """
    cell_line_1 = CellLineFactory()
    cell_line_na = CellLineFactory()
    cell_line_3 = CellLineFactory()
    gene: Gene = GeneFactory() # pyright: ignore

    cell_line_objs = [
        cell_line_3,
        cell_line_na,
        cell_line_1,
    ]  # deliberately changing the order from the order that the cell lines were created in
    data = np.array([[3, np.NaN, 1]])  # data matches cell line order

    dep_matrix = MatrixFactory(
        entities=[gene], cell_lines=cell_line_objs, data=data, units="test units"
    )
    dep_dataset = DependencyDatasetFactory(matrix=dep_matrix)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    dataset_id = dep_dataset.name.name
    feature_data_srs = models.get_feature_data(dataset_id, gene.label)
    metadata = models.get_entity_summary_metadata(dataset_id, feature_data_srs, gene.label)

    
    df = models.integrate_cell_line_information(feature_data_srs)

    assert df.shape == (
        2,
        6,
    )  # 2 rows, 6 columns from 1 value column + 5 more cell line information columns
    assert df.loc[[cell_line_1.depmap_id, cell_line_3.depmap_id]]["value"].tolist() == [
        1,
        3,
    ]  # NA row is dropped


def test_integrate_size_and_label_data(empty_db_mock_downloads):
    """
    Test for where size (expression) data is present 
    """
    cell_line_1 = CellLineFactory()
    cell_line_2 = CellLineFactory()
    gene = GeneFactory()
    cell_line_objs = [cell_line_1, cell_line_2]
    size_biom_enum = BiomarkerDataset.BiomarkerEnum.expression

    expression_df = pd.DataFrame(
        {cell_line_1.cell_line_name: [1], cell_line_2.cell_line_name: [2]},
        index=[gene.label],
    )
    expression_matrix = MatrixFactory(
        entities=[gene],
        cell_lines=cell_line_objs,
        data=expression_df.values,
        units="test units",
    )
    BiomarkerDatasetFactory(matrix=expression_matrix, name=size_biom_enum)
    empty_db_mock_downloads.session.flush()

    value = [10, 20]
    depmap_ids = [cell_line_obj.depmap_id for cell_line_obj in cell_line_objs]

    data = {
        "value": value,
        "primary_disease": [x.primary_disease.name for x in cell_line_objs],
        "cell_line_display_name": [x.cell_line_display_name for x in cell_line_objs],
    }
    test_df = pd.DataFrame(data, index=depmap_ids)
    df, legend = models.integrate_size_and_label_data(
        test_df, "test dep units", size_biom_enum, gene.entity_id
    )

    expression = [1, 2]
    expected_df = pd.DataFrame(
        {
            "label": [
                "<b>{}</b><br>Disease: {}<br>test dep units: 10<br>Expression (test units): 1".format(
                    cell_line_1.cell_line_display_name, cell_line_1.primary_disease.name
                ),
                "<b>{}</b><br>Disease: {}<br>test dep units: 20<br>Expression (test units): 2".format(
                    cell_line_2.cell_line_display_name, cell_line_2.primary_disease.name
                ),
            ],
            "expression": expression,
            "size": [models.expression_to_size(x) for x in expression],
            "value": value,
            "primary_disease": data["primary_disease"],
            "cell_line_display_name": data["cell_line_display_name"],
        },
        index=depmap_ids,
    )
    assert dfs_equal_ignoring_column_order(df, expected_df)
    assert "expression" in legend


@pytest.mark.parametrize("entity_factory", [(GeneFactory), (CompoundExperimentFactory)])
def test_integrate_size_and_label_data_no_data(empty_db_mock_downloads, entity_factory):
    """
    Test for when a gene is not present in the expression dataset
    """
    entity = entity_factory()
    size_biom_enum = BiomarkerDataset.BiomarkerEnum.expression
    BiomarkerDatasetFactory(name=size_biom_enum)

    value = [10, 20]
    cell_line_1 = CellLineFactory()
    cell_line_2 = CellLineFactory()
    empty_db_mock_downloads.session.flush()
    cell_line_objs = [cell_line_1, cell_line_2]

    depmap_ids = [cell_line_obj.depmap_id for cell_line_obj in cell_line_objs]
    data = {
        "value": value,
        "primary_disease": [x.primary_disease.name for x in cell_line_objs],
        "cell_line_display_name": [x.cell_line_display_name for x in cell_line_objs],
    }
    test_df = pd.DataFrame(data, index=depmap_ids)
    df, legend = models.integrate_size_and_label_data(
        test_df, "test dep units", size_biom_enum, entity.entity_id
    )

    expected_df = pd.DataFrame(
        {
            "label": [
                "<b>{}</b><br>Disease: {}<br>test dep units: 10".format(
                    cell_line_1.cell_line_display_name, cell_line_1.primary_disease.name
                ),
                "<b>{}</b><br>Disease: {}<br>test dep units: 20".format(
                    cell_line_2.cell_line_display_name, cell_line_2.primary_disease.name
                ),
            ],
            "size": [models.expression_to_size(x) for x in [0, 0]],
            "value": value,
            "primary_disease": data["primary_disease"],
            "cell_line_display_name": data["cell_line_display_name"],
        },
        index=depmap_ids,
    )
    print(df)
    print(expected_df)
    assert dfs_equal_ignoring_column_order(df, expected_df)
    assert "expression" not in legend


@pytest.mark.xfail(
    reason="This test relies on get_rna_mutations_colors which is broken. See the warning in that function for more information"
)
def test_integrate_color_data(empty_db_mock_downloads):
    """
    Test that sorts by correct color number order. At the very least, if the code accidentally changes so that it sorts by hex code, either:
        1) the hex code order is the same, and the outcome is the same
        2) this test will break. yay!
    """
    cell_line_mut = CellLineFactory(cell_line_name="mut_1")
    cell_line_no_mut = CellLineFactory(cell_line_name="no_mut")
    cell_line_mut2 = CellLineFactory(cell_line_name="mut_2")
    gene = GeneFactory()
    mutations_prioritized_matrix = MatrixFactory(
        entities=[gene], cell_lines=[cell_line_no_mut, cell_line_mut, cell_line_mut2]
    )
    BiomarkerDatasetFactory(
        matrix=mutations_prioritized_matrix,
        name=BiomarkerDataset.BiomarkerEnum.mutations_prioritized,
    )
    cell_lines = [
        cell_line_mut.depmap_id,
        cell_line_no_mut.depmap_id,
        cell_line_mut2.depmap_id,
    ]  # mut goes first so we can check that sorting changes the order
    value = [3, 1, 2]  # test that any other columns get sorted as well
    test_df = pd.DataFrame({"value": value}, index=cell_lines)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    legend = {}
    color = BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
    label = gene.label

    expected_df = pd.DataFrame(
        {"mutation_num": [0, 1, 2], "value": [1, 3, 2],},
        index=[
            cell_line_no_mut.depmap_id,
            cell_line_mut.depmap_id,
            cell_line_mut2.depmap_id,
        ],
    )

    df, legend = models.integrate_color_data(test_df, legend, color, label)

    assert dfs_equal_ignoring_column_order(df, expected_df)

    assert "mutation" in legend


@pytest.mark.parametrize("entity_factory", [(GeneFactory), (CompoundExperimentFactory)])
def test_integrate_color_data_no_data(empty_db_mock_downloads, entity_factory):
    entity = entity_factory()
    fake_cell_lines = [
        CellLineFactory(cell_line_name="fake_cell_line_1"),
        CellLineFactory(cell_line_name="fake_cell_line_2"),
    ]
    real_cell_lines = [
        CellLineFactory(cell_line_name="real_cell_line_1"),
        CellLineFactory(cell_line_name="real_cell_line_2"),
    ]

    if entity_factory == GeneFactory:
        gene = GeneFactory()
        mutations_prioritized_matrix = MatrixFactory(
            entities=[gene], cell_lines=real_cell_lines
        )
        BiomarkerDatasetFactory(
            matrix=mutations_prioritized_matrix,
            name=BiomarkerDataset.BiomarkerEnum.mutations_prioritized,
        )
        color = BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
        value = [1, 2]
    else:
        color = None
        value = [0, 0]

    test_df = pd.DataFrame({"value": value}, index=fake_cell_lines)
    legend = {}
    label = entity.label

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected_df = pd.DataFrame(
        {"mutation_num": [0, 0], "value": value}, index=fake_cell_lines
    )

    df, legend = models.integrate_color_data(test_df, legend, color, label)

    assert dfs_equal_ignoring_column_order(df, expected_df)

    # We don't have coverage data and thus cannot say anything about the /absence/ of a mutation. So if there are none, we just don't show the legend and avoid commenting on it.
    # When genes get coverage data, 'mutation' should be in legend for genes
    assert "mutation" not in legend


def test_format_strip_plot(empty_db_mock_downloads):
    """
    Given a df, returns a strip plot ordered such that each lineage level 1 has their lineage level 2 immediately following it
    :return: 
    """
    cell_line_1 = CellLineFactory(
        cell_line_name="cell_line_1",
        lineage=[
            LineageFactory(name="lineage_lvl1_1", level=1),
            LineageFactory(name="lineage_lvl2_1", level=2),
        ],
    )
    cell_line_2 = CellLineFactory(
        cell_line_name="cell_line_2",
        lineage=[
            LineageFactory(name="lineage_lvl1_1", level=1),
            LineageFactory(name="lineage_lvl2_2", level=2),
        ],
    )
    cell_line_3 = CellLineFactory(
        cell_line_name="cell_line_3",
        lineage=[LineageFactory(name="lineage_lvl1_2", level=1)],
    )
    cell_lines_and_lineage_level = [
        (cell_line_1, 1),
        (cell_line_1, 2),
        (cell_line_3, 1),  # mix things up, to test ordering
        (cell_line_2, 1),
        (cell_line_2, 2),
    ]
    labels = ["hover text" for x, _ in cell_lines_and_lineage_level]
    values = [1, 1, 3, 2, 2]
    sizes = [
        10,
        10,
        30,
        20,
        20,
    ]
    mutation_nums = [0, 0, 0, 1, 1]
    depmap_ids = [x.depmap_id for x, _ in cell_lines_and_lineage_level]
    lineages = [
        [lineage for lineage in x.lineage.all() if lineage.level == level][0]
        for x, level in cell_lines_and_lineage_level
    ]

    data = {
        "label": labels,
        "value": values,
        "size": sizes,
        # this makes no sense, but deliberately making size an inverse sort order to make sure it won't mess things up
        "mutation_num": mutation_nums,
        "depmap_id": [x.depmap_id for x, _ in cell_lines_and_lineage_level],
        "cell_line_name": [x.cell_line_name for x, _ in cell_lines_and_lineage_level],
        "cell_line_display_name": [
            x.cell_line_display_name for x, _ in cell_lines_and_lineage_level
        ],
        "primary_disease": [x.primary_disease for x, _ in cell_lines_and_lineage_level],
        "lineage_name": [lineage.name for lineage in lineages],
        "lineage_display_name": [lineage.display_name for lineage in lineages],
        "lineage_level": [lineage.level for lineage in lineages],
    }

    test_df = pd.DataFrame(data, index=depmap_ids)

    expected = {
        "url_root": "/cell_line/",
        "traces": [
            {
                "data": {
                    "depmap_id": [
                        cell_line_1.depmap_id,
                        cell_line_2.depmap_id,
                    ],  # all cell lines in lineage level1 1
                    "cell_line_information": [
                        {
                            "depmap_id": cell_line_1.depmap_id,
                            "cell_line_display_name": cell_line_1.cell_line_display_name,
                        },
                        {
                            "depmap_id": cell_line_2.depmap_id,
                            "cell_line_display_name": cell_line_2.cell_line_display_name,
                        },
                    ],
                    "label": ["hover text", "hover text"],
                    "value": [1, 2],
                    "size": [10, 20],
                    "mutation_num": [0, 1],
                },
                "category": "Lineage Lvl1 1",
                "lineage_level": 1,
                "num_lines": 2,
            },
            {
                "data": {
                    "depmap_id": [
                        cell_line_1.depmap_id
                    ],  # cell lines in the level 2 sublineage. this trace immediately follows the level 1
                    "cell_line_information": [
                        {
                            "depmap_id": cell_line_1.depmap_id,
                            "cell_line_display_name": cell_line_1.cell_line_display_name,
                        }
                    ],
                    "label": ["hover text"],
                    "value": [1],
                    "size": [10],
                    "mutation_num": [0],
                },
                "category": "Lineage Lvl2 1",
                "lineage_level": 2,
                "num_lines": 1,
            },
            {
                "data": {
                    "depmap_id": [
                        cell_line_2.depmap_id
                    ],  # cell lines in the level 2 sublineage
                    "cell_line_information": [
                        {
                            "depmap_id": cell_line_2.depmap_id,
                            "cell_line_display_name": cell_line_2.cell_line_display_name,
                        }
                    ],
                    "label": ["hover text"],
                    "value": [2],
                    "size": [20],
                    "mutation_num": [1],
                },
                "category": "Lineage Lvl2 2",
                "lineage_level": 2,
                "num_lines": 1,
            },
            {
                "data": {
                    "depmap_id": [
                        cell_line_3.depmap_id
                    ],  # all cell lines in lineage level1 1
                    "cell_line_information": [
                        {
                            "depmap_id": cell_line_3.depmap_id,
                            "cell_line_display_name": cell_line_3.cell_line_display_name,
                        }
                    ],
                    "label": ["hover text"],
                    "value": [3],
                    "size": [30],
                    "mutation_num": [0],
                },
                "category": "Lineage Lvl1 2",
                "lineage_level": 1,
                "num_lines": 1,
            },
        ],
    }

    assert models.format_strip_plot(test_df) == expected



def test_get_download_data(app, empty_db_mock_downloads):
    """
    Tests that endpoint outputs a csv, that can be then read by pandas
    The expected filename should be the gene with the dependency dataset name
    """
    cell_line = CellLineFactory()
    gene: Gene = GeneFactory() # pyright: ignore

    expression_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])

    BiomarkerDatasetFactory(
        matrix=expression_matrix, name=BiomarkerDataset.BiomarkerEnum.expression
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    dataset_enum_name = BiomarkerDataset.BiomarkerEnum.expression.name


    result = models.get_download_data(
        dataset_id=dataset_enum_name,
        entity=gene,
        size_dataset_enum=None,
        color_dataset_id=None,
    )
    assert result is not None
    with app.test_client() as c:
        res = c.get(
            url_for(
                "partials.entity_summary_download",
                entity_id=gene.entity_id,
                dep_enum_name=dataset_enum_name,
                size_biom_enum_name="none",
                color="none",
            )
        )
        assert res.status_code == 200, res.status_code
        df = pd.read_csv(StringIO(res.data.decode("utf-8")))
        assert len(df) == 1
        dataset = Dataset.get_dataset_by_name(dataset_enum_name)
        assert dataset is not None
        expected_filename = dataset.display_name
        assert (
            "filename={} {}.csv".format(gene.label, expected_filename)
            in res.headers["Content-Disposition"]
        )
        expected_column_names = [
            "Depmap ID",
            "Cell Line Name",
            "Primary Disease",
            "Lineage",
            "Lineage Subtype",
            expected_filename,
        ]
        assert set(expected_column_names) == set(df.columns)