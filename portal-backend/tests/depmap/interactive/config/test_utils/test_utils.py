import pytest

from depmap.dataset.models import TabularDataset
from depmap.interactive import interactive_utils
from tests.conftest import InteractiveConfigFakeMutationsDownload
from tests.depmap.interactive.fixtures import *
from tests.factories import DependencyDatasetFactory, TaigaAliasFactory
from tests.utilities import interactive_test_utils


def test_getters(interactive_db_mock_downloads):
    """
    Test the following methods for both axes and color datasets:
    get_dataset_label
    get_dataset_units (not applicable for color)
    get_feature_name
    get_taiga_id
    """
    interactive_config = InteractiveConfigFakeMutationsDownload()

    avana_id = standard_aliased_dataset_id
    assert (
        interactive_utils.get_dataset_label(avana_id)
        == interactive_config.get(avana_id)["label"]
    )
    assert (
        interactive_utils.get_dataset_units(avana_id)
        == interactive_config.get(avana_id)["units"]
    )
    assert (
        interactive_utils.get_dataset_data_type(avana_id)
        == interactive_config.get(avana_id)["data_type"].value
    )
    assert (
        interactive_utils.get_dataset_priority(avana_id)
        == interactive_config.get(avana_id)["priority"]
    )
    assert (
        interactive_utils.get_feature_name(avana_id)
        == interactive_config.get(avana_id)["feature_name"]
    )
    assert (
        interactive_utils.get_taiga_id(avana_id)
        == interactive_config.get(avana_id)["taiga_id"]
    )
    assert (
        interactive_utils.get_original_taiga_id(avana_id)
        == interactive_config.get(avana_id)["original_taiga_id"]
    )

    mutation_id = TabularDataset.TabularEnum.mutation.name
    assert (
        interactive_utils.get_dataset_label(mutation_id)
        == interactive_config.get(mutation_id)["label"]
    )
    assert (
        interactive_utils.get_feature_name(mutation_id)
        == interactive_config.get(mutation_id)["feature_name"]
    )

    assert (
        interactive_utils.get_taiga_id(nonstandard_aliased_dataset_id)
        == nonstandard_aliased_dataset_id
    )


@pytest.mark.parametrize(
    "dataset, expected",
    [
        (prepopulated_dataset, prepopulated_dataset_feature_example),
        (standard_aliased_dataset_id, None),
    ],
)
def test_get_feature_example(interactive_db_mock_downloads, dataset, expected):
    assert interactive_utils.get_feature_example(dataset) == expected


@pytest.mark.parametrize(
    "dataset_id, expected",
    [
        (TabularDataset.TabularEnum.mutation.name, False),
        ("invalid_dataset", False),
        (standard_aliased_dataset_id, True),
        (nonstandard_aliased_dataset_id, True),
        (nonstandard_nonaliased_dataset_id, True),
    ],
)
def test_is_continuous(interactive_db_mock_downloads, dataset_id, expected):
    assert interactive_utils.is_continuous(dataset_id) == expected, dataset_id


def test_get_all_original_taiga_ids(empty_db_mock_downloads):
    """
    Test that
        returns original taiga ids, not the canonical
        filters out nones
    """
    # assert set up
    dataset_with_no_taiga_id = interactive_utils.get_gender_dataset()
    assert interactive_utils.get_taiga_id(dataset_with_no_taiga_id) == None

    # set up dep dataset
    dep_original_taiga_id = "dep-original-taiga-id.1/file"
    dep_canonical_taiga_id = "dep-canonical-taiga-id.1/file"

    DependencyDatasetFactory(taiga_id=dep_original_taiga_id)
    TaigaAliasFactory(
        taiga_id=dep_original_taiga_id, canonical_taiga_id=dep_canonical_taiga_id
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    original_taiga_ids = interactive_utils.get_all_original_taiga_ids()

    assert dep_original_taiga_id in original_taiga_ids
    assert dep_canonical_taiga_id not in original_taiga_ids
    assert not any([x is None for x in original_taiga_ids])
