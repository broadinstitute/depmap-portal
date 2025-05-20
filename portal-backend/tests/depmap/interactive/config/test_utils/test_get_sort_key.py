import json
from depmap.dataset.models import Dataset
from depmap.enums import BiomarkerEnum, DependencyEnum
from depmap.interactive import interactive_utils
from depmap.interactive.config.models import DatasetSortKey
from depmap.gene.models import Gene
from depmap.settings.settings import TestConfig
from tests.factories import (
    BiomarkerDatasetFactory,
    DependencyDatasetFactory,
    NonstandardMatrixFactory,
    CustomDatasetConfigFactory,
    PrivateDatasetMetadataFactory,
)
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override

nonstandard_related_to_standard_id = "test-id.1/related"
nonstandard_other_id = "test-id.1/other"


def config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            nonstandard_related_to_standard_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "Standard dataset display name 2 nonstandard related",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
                "entity": Gene,
            },
            nonstandard_other_id: {
                "transpose": False,
                "use_arxspan_id": True,
                "label": "nonstandard other label",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
                "entity": Gene,
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=config)
def test_get_sort_key(empty_db_mock_downloads):
    """
    Test that
        1) Custom and private datasets are the most important and should appear first (not included in this function)
        2) Generally, standard datasets appear before nonstandard
        3) Some standard datasets are more important than others. These should appear before the other standard datasets
        4) The nonstandard PR (gene_dependency) datasets should appear next to the standard gene_effect datasets (these are Chronos_Combined, etc DependencyDatasets that use the gene_effect file from taiga).
        5) Finally, we can have the rest of the nonstandard datasets
    """

    custom_dataset = CustomDatasetConfigFactory(
        config=json.dumps(
            {
                "label": "custom label",
                "units": "custom units",
                "data_type": "user_upload",
                "feature_name": "custom feature",
                "is_custom": True,
                "is_continuous": True,
                "is_standard": False,
                "is_discoverable": False,
                "transpose": False,
            }
        )
    )

    standard_prioritized_dataset_0 = DependencyDatasetFactory(
        name=DependencyEnum.Chronos_Combined,
        display_name="Standard dataset display name 0",
        global_priority=1,
    )

    standard_prioritized_dataset_1 = DependencyDatasetFactory(
        name=DependencyEnum.RNAi_merged,
        display_name="Standard dataset display name 1",
        global_priority=2,
    )

    standard_prioritized_dataset_2 = BiomarkerDatasetFactory(
        name=BiomarkerEnum.expression,
        display_name="Standard dataset display name 2",
        global_priority=3,
    )

    standard_other_dataset = BiomarkerDatasetFactory(
        name=BiomarkerEnum.copy_number_absolute
    )

    empty_db_mock_downloads.session.flush()

    prioritized_standard_dataset_enums = (
        Dataset.query.filter(Dataset.global_priority != None)
        .order_by(Dataset.global_priority)
        .all()
    )
    assert standard_prioritized_dataset_0 in prioritized_standard_dataset_enums
    assert standard_prioritized_dataset_1 in prioritized_standard_dataset_enums
    assert standard_prioritized_dataset_2 in prioritized_standard_dataset_enums
    assert standard_other_dataset not in prioritized_standard_dataset_enums

    # load the interactive
    interactive_test_utils.reload_interactive_config()

    custom_sort_key = interactive_utils.get_sort_key(custom_dataset.uuid)
    assert custom_sort_key == DatasetSortKey(0, 0, "custom label")

    standard_prioritized_sort_key = interactive_utils.get_sort_key(
        standard_prioritized_dataset_2.name.name
    )
    assert standard_prioritized_sort_key == DatasetSortKey(
        1, 2, "Standard dataset display name 2"
    )

    standard_other_sort_key = interactive_utils.get_sort_key(
        standard_other_dataset.name.name
    )
    # Make sure it is after the last prioritized standard datasets
    assert standard_other_sort_key == DatasetSortKey(
        1, 3, standard_other_dataset.display_name
    )

    nonstandard_related_to_standard_sort_key = interactive_utils.get_sort_key(
        nonstandard_related_to_standard_id
    )
    # NOTE: Nonstard datasets are related to standard datasets if their display name starts the same way as the standard dataset
    assert nonstandard_related_to_standard_sort_key == DatasetSortKey(
        1, 2, "Standard dataset display name 2 nonstandard related"
    )

    nonstandard_other_sort_key = interactive_utils.get_sort_key(nonstandard_other_id)
    assert nonstandard_other_sort_key == DatasetSortKey(2, 0, "nonstandard other label")

    expected_order = [
        custom_sort_key,
        standard_prioritized_sort_key,
        nonstandard_related_to_standard_sort_key,
        standard_other_sort_key,
        nonstandard_other_sort_key,
    ]
    assert sorted(expected_order) == expected_order
