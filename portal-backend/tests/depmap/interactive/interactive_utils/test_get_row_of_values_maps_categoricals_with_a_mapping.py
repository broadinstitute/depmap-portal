from depmap.settings.settings import TestConfig
from depmap.interactive import interactive_utils
from depmap.interactive.config.categories import Category, CategoryConfig
from tests.factories import NonstandardMatrixFactory, CellLineFactory
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override

dataset_id_with_map = "dataset-id.1/with_map"
dataset_id_no_map = "dataset-id.1/no_map"
row_label = "row_label"


class TestCategoryConfig(CategoryConfig):
    def get_non_na_category(self, value, feature):
        return Category(value, color_num=1)


class TestCategoryWithMap(TestCategoryConfig):
    def map_value(self, value, feature):
        return "value: {}, feature: {}".format(value, feature)


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            dataset_id_with_map: {
                "label": "has map",
                "transpose": False,
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "prepopulate": True,
                "is_categorical": True,
                "categories": TestCategoryWithMap(),
            },
            dataset_id_no_map: {
                "label": "no map",
                "transpose": False,
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "prepopulate": True,
                "is_categorical": True,
                "categories": TestCategoryConfig(),
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_get_row_of_values_maps_categoricals_with_a_mapping(
    empty_db_mock_downloads, app
):
    """
    Test that
        when no map_value if defined on the category config, get_row_of_values returns just the matrix calue
        when it is defined, it returns the output of the map_value function
    """
    # Cell line factory needs to be defined due to a winkle in the setup of the matrix factory. If no cell lines are defined, it calls the col index factory to produce a sequence of indices
    # This sequence continues across multiple MatrixFactories, so the second one ends up with a bad sequence
    # We should probably make that stuff work better, but haven't gotten to it
    NonstandardMatrixFactory(
        nonstandard_dataset_id=dataset_id_with_map,
        entities=[row_label],
        cell_lines=[CellLineFactory()],
        rows_are_entities=False,
    )
    NonstandardMatrixFactory(
        nonstandard_dataset_id=dataset_id_no_map,
        entities=[row_label],
        cell_lines=[CellLineFactory()],
        rows_are_entities=False,
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    value_no_map = interactive_utils.get_row_of_values(dataset_id_no_map, row_label)
    value_with_map = interactive_utils.get_row_of_values(dataset_id_with_map, row_label)

    assert len(value_no_map) == len(value_with_map) == 1
    assert value_no_map[0] == 0  # 0 is the default value for the factory
    assert value_with_map[0] == "value: 0, feature: row_label"
