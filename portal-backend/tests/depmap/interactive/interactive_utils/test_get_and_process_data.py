from math import isclose
import pandas as pd
import pytest
from numpy import isnan

from depmap.vector_catalog.models import SliceSerializer, SliceRowType
from depmap.dataset.models import TabularDataset, BiomarkerDataset, DependencyDataset
from depmap.cell_line.models import CellLine
from depmap.interactive import interactive_utils
from depmap.interactive.config.categories import CategoryConfig
from depmap.interactive.nonstandard.models import NonstandardMatrix
from depmap.interactive.common_utils import format_features_from_value
from depmap.settings.settings import TestConfig
from depmap.utilities import hdf5_utils
from tests.depmap.interactive.fixtures import *
from tests.utilities.override_fixture import override
from tests.utilities import interactive_test_utils
from tests.factories import (
    GeneFactory,
    DatasetFactory,
    DependencyDatasetFactory,
    MatrixFactory,
    NonstandardMatrixFactory,
    CellLineFactory,
)

nonstandard_dataset_id = "test-id.1"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_dataset_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "test label",
                "units": "test units",
                "feature_name": "test name",
                "is_continuous": True,
                "data_type": "user_upload",
            }
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


# just test that it does delegate to nonstandard, which has 3 results.
# nonstandard with aliases, and standard with aliases are respectively tested in test_nonstandard_utils and test_standard_utils. The alias tests also need global search to be loaded
@pytest.mark.parametrize(
    "dataset_id, prefix, expected",
    [
        (
            nonstandard_nonaliased_dataset_id,
            "met",  # nonstandard, no aliases
            [
                "MET",
                "METAP1",
                "METAP1D",
                "METAP2",
                "METRN",
                "METRNL",
                "METTL1",
                "METTL10",
                "METTL11B",
                "METTL12",
            ],
        ),
        (standard_aliased_dataset_id, "invalid_prefix", []),
        ("context", "l", "error"),
        ("invalid_dataset", "l", "error"),
    ],
)
def test_get_matching_rows(interactive_db_mock_downloads, dataset_id, prefix, expected):
    """
    Axes datasets are tested in test_standard_utils
    Also test case insensitivity
    Implicitly tests standard_utils.get_matching_rows when testing Avana (standard axes dataset)
    Uses nonstandard_nonaliased_dataset_id instead of the entity one, so that it doesn't have to deal with aliases and not being able to use format_features_from_value
    """
    if expected == "error":
        with pytest.raises(ValueError):
            interactive_utils.get_matching_rows(dataset_id, prefix)
    else:
        assert interactive_utils.get_matching_rows(
            dataset_id, prefix
        ) == format_features_from_value(expected)


def test_get_all_rows(interactive_db_mock_downloads):
    # correctness of the nonstandard utils path is handled in test_nonstandard_utils/test_get_all_row_names
    # and parallel for the standard utils path
    assert interactive_utils.get_all_rows(interactive_utils.get_context_dataset()) == [
        {"label": "ALKHotspot", "value": "ALKHotspot"},
        {"label": "BONE", "value": "BONE"},
        {"label": "EGFR", "value": "EGFR"},
        {"label": "ES", "value": "ES"},
        {"label": "LUAD", "value": "LUAD"},
        {"label": "LUNG", "value": "LUNG"},
        {"label": "LUSC", "value": "LUSC"},
        {"label": "MCC", "value": "MCC"},
        {"label": "MEL", "value": "MEL"},
        {"label": "NSCLC", "value": "NSCLC"},
        {"label": "OS", "value": "OS"},
        {"label": "PNS", "value": "PNS"},
        {"label": "SKIN", "value": "SKIN"},
    ]


@pytest.mark.parametrize(
    "dataset_id, row_name, is_valid",
    [
        (BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name, "MAP4K4", True),
        (BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name, "TRIL", False),
        ("context", "LUNG", True),
        ("context", "MAP4K4", False),
        ("lineage", "all", True),
        ("lineage", "bone", False),
        (standard_aliased_dataset_id, "MAP4K4", True),
        (standard_aliased_dataset_id, "TRIL", False),
        (nonstandard_aliased_dataset_id, "ABCD1", True),
        (nonstandard_aliased_dataset_id, "TRIL", False),
        (nonstandard_nonaliased_dataset_id, "ABCD1", True),
        (nonstandard_nonaliased_dataset_id, "TRIL", False),
        (custom_cell_line_group_dataset_id, custom_cell_line_group_feature, True),
        (custom_cell_line_group_dataset_id, "bad uuid", False),
        ("invalid_dataset", "MAP4K4", "error"),
    ],
)
def test_valid_row(interactive_db_mock_downloads, dataset_id, row_name, is_valid):
    """
    Axes datasets are tested in test_standard_utils
    Implicitly tests standard_utils.valid_row when testing Avana (standard axes dataset) 
    """
    if is_valid == "error":
        with pytest.raises(ValueError):
            interactive_utils.valid_row(dataset_id, row_name)
    else:
        assert interactive_utils.valid_row(dataset_id, row_name) == is_valid


def test_get_row_of_values(interactive_db_mock_downloads):
    """
    Test all datasets, including axes datasets, here
    This implicitly tests standard_utils.get_row_of_values
    """
    # standard dataset
    expected_avana_index = [
        "ACH-000014",
        "ACH-000788",
        "ACH-000580",
        "ACH-001001",
        "ACH-000458",
        "ACH-000706",
        "ACH-000585",
        "ACH-000425",
        "ACH-000810",
        "ACH-000304",
    ]
    first_avana_value = 0.191115
    avana_series = interactive_utils.get_row_of_values(
        standard_aliased_dataset_id, standard_aliased_dataset_feature
    )
    assert list(avana_series.index) == expected_avana_index
    assert isclose(list(avana_series.values)[0], first_avana_value, abs_tol=1e-3)

    # nonstandard, entity mapped dataset
    nonstandard_entity_series = interactive_utils.get_row_of_values(
        nonstandard_aliased_dataset_id, "ABCD1"
    )
    assert isclose(nonstandard_entity_series["ACH-001001"], 0.1236756679)

    # nonstandard dataset without mapped entities
    nonstandard_entity_series = interactive_utils.get_row_of_values(
        nonstandard_nonaliased_dataset_id, nonstandard_nonaliased_feature
    )
    assert isclose(nonstandard_entity_series["ACH-001001"], 0.1236756679)

    expected_context_series = pd.Series(
        context_dataset_feature,
        ["ACH-001001", "ACH-000052", "ACH-000210", "ACH-000279", "ACH-001205"],
    )

    found_context_series = interactive_utils.get_row_of_values(
        context_dataset_id, context_dataset_feature
    )

    assert found_context_series.equals(expected_context_series)

    expected_custom_cell_lines_series = pd.Series(1, custom_cell_line_group_depmap_ids)
    assert interactive_utils.get_row_of_values(
        custom_cell_line_group_dataset_id, custom_cell_line_group_feature
    ).equals(expected_custom_cell_lines_series)

    expected_mutations_in_series = ["Other", "Other non-conserving", "Damaging"]
    result_mutation_series = interactive_utils.get_row_of_values(
        BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
        mutations_dataset_feature,
    )
    assert all(x in result_mutation_series.values for x in expected_mutations_in_series)

    expected_lineage_series = pd.Series(
        [
            "skin",
            "bone",
            "bone",
            "bone",
            "skin",
            "skin",
            "skin",
            "skin",
            "colorectal",
            "skin",
            "unknown",
            "lung",
            "skin",
            "skin",
            "skin",
            "skin",
            "bone",
            "skin",
            "bone",
            "fibroblast",
        ],
        [
            "ACH-000014",
            "ACH-000052",
            "ACH-000210",
            "ACH-000279",
            "ACH-000304",
            "ACH-000425",
            "ACH-000441",
            "ACH-000458",
            "ACH-000552",
            "ACH-000580",
            "ACH-000585",
            "ACH-000706",
            "ACH-000788",
            "ACH-000805",
            "ACH-000810",
            "ACH-000899",
            "ACH-001001",
            "ACH-001170",
            "ACH-001205",
            "ACH-000131",
        ],
    )

    assert interactive_utils.get_row_of_values(
        lineage_dataset_id, lineage_dataset_feature
    ).equals(expected_lineage_series)


def test_get_row_of_values_drops_nas(interactive_db_mock_downloads):
    """
    Test that get_row_of_values does not return nas, even if there are nas in the underlying hdf5 file and for existing row indices
    """

    ## Verify test setup
    matrix = NonstandardMatrix.get(nonstandard_aliased_dataset_id)

    # Verify that it actually exists in the db (is not dropped because it's not in the db)
    cell_line_with_nan = CellLine.get_by_name("CADOES1_BONE", must=True)

    # get the index of the cell line that should have the nan value
    col_index = hdf5_utils.get_col_index(
        interactive_db_mock_downloads.app.config["NONSTANDARD_DATA_DIR"],
        matrix.file_path,
    )
    cell_line_index = col_index.index("CADOES1_BONE")

    # verify that for the gene we are about to test, there is the cell line in question that has the nan value
    row_index = [row for row in matrix.row_index if row.entity.label == "ABCD1"][
        0
    ].index
    values = hdf5_utils.get_row_of_values(
        interactive_db_mock_downloads.app.config["NONSTANDARD_DATA_DIR"],
        matrix.file_path,
        row_index,
    )
    assert isnan(values[cell_line_index])

    ## Test that row of values doesn't contain na
    # nonstandard, entity mapped dataset
    row_of_values = interactive_utils.get_row_of_values(
        nonstandard_aliased_dataset_id, "ABCD1"
    )

    # test that NA value and cell line are dropped
    assert len(row_of_values) > 0  # sanity check
    assert isnan(row_of_values).sum() == 0
    assert cell_line_with_nan.depmap_id not in row_of_values.index


# This is a tombstone marker for devs looking for the test. Please do not remove
# def test_get_row_of_values_maps_categoricals_with_a_mapping(empty_db_mock_downloads):
# test is located in separate file, test_get_row_of_values_maps_categoricals_with_a_mapping.py


def test_get_row_of_values_from_slice_id(empty_db_mock_downloads):
    cell_line = CellLineFactory()
    gene = GeneFactory()

    matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])
    dataset = DependencyDatasetFactory(matrix=matrix)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected_series = interactive_utils.get_row_of_values(dataset.name.name, gene.label)
    assert expected_series.equals(
        interactive_utils.get_row_of_values_from_slice_id(
            SliceSerializer.encode_slice_id(
                dataset.name.name, gene.label, SliceRowType.label
            )
        )
    )
    assert expected_series.equals(
        interactive_utils.get_row_of_values_from_slice_id(
            SliceSerializer.encode_slice_id(
                dataset.name.name, gene.entity_id, SliceRowType.entity_id
            )
        )
    )


def test_get_category_config(interactive_db_mock_downloads):
    for dataset in [
        context_dataset_id,
        TabularDataset.TabularEnum.mutation.name,
        lineage_dataset_id,
        custom_cell_line_group_dataset_id,
    ]:
        assert isinstance(
            interactive_utils.get_category_config(dataset), CategoryConfig
        )


@override(config=config)
def test_get_dataset_sample_ids(app, empty_db_mock_downloads):
    standard_dataset_name = DependencyDataset.DependencyEnum.Chronos_Combined
    DependencyDatasetFactory(matrix=MatrixFactory(), name=standard_dataset_name)
    NonstandardMatrixFactory(nonstandard_dataset_id)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    assert len(interactive_utils.get_dataset_sample_ids(nonstandard_dataset_id)) > 0
    assert interactive_utils.get_dataset_sample_ids(nonstandard_dataset_id)[
        0
    ].startswith("ACH-")

    assert len(interactive_utils.get_dataset_sample_ids(standard_dataset_name.name)) > 0
    assert interactive_utils.get_dataset_sample_ids(standard_dataset_name.name)[
        0
    ].startswith("ACH-")


@override(config=config)
def test_get_dataset_sample_labels_by_id(app, empty_db_mock_downloads):
    """Tests that all samples belonging to the dataset are returned."""
    cell_lines = CellLineFactory.create_batch(3)

    standard_dataset_name = DependencyDataset.DependencyEnum.Chronos_Combined
    DependencyDatasetFactory(
        matrix=MatrixFactory(cell_lines=cell_lines), name=standard_dataset_name
    )
    NonstandardMatrixFactory(nonstandard_dataset_id, cell_lines=cell_lines)

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected_result = {
        cell_line.depmap_id: cell_line.cell_line_display_name
        for cell_line in cell_lines
    }

    nonstandard_dataset_result = interactive_utils.get_dataset_sample_labels_by_id(
        nonstandard_dataset_id
    )
    assert nonstandard_dataset_result == expected_result

    standard_dataset_result = interactive_utils.get_dataset_sample_labels_by_id(
        standard_dataset_name.name
    )
    assert standard_dataset_result == expected_result
