import json
import pytest
from depmap.taiga_id.models import TaigaAlias
from loader import taiga_id_loader
from tests.factories import (
    TaigaAliasFactory,
    DependencyDatasetFactory,
    TabularDatasetFactory,
    CustomDatasetConfigFactory,
)
from tests.conftest import InteractiveConfigFakeMutationsDownload


@pytest.mark.parametrize(
    "dataset_is_canonical, tabular_is_canonical, passes",
    [(True, True, True), (True, False, False), (False, True, False)],
)
def test_assert_loaded_db_taiga_ids_are_canonical(
    empty_db_mock_downloads, dataset_is_canonical, tabular_is_canonical, passes
):
    canonical_id = "canonical-id.1/file"
    virtual_id = "virtual-id.1"

    TaigaAliasFactory(taiga_id=canonical_id, canonical_taiga_id=canonical_id)
    TaigaAliasFactory(taiga_id=virtual_id, canonical_taiga_id=canonical_id)

    if dataset_is_canonical:
        DependencyDatasetFactory(taiga_id=canonical_id)
    else:
        DependencyDatasetFactory(taiga_id=virtual_id)

    if tabular_is_canonical:
        TabularDatasetFactory(taiga_id=canonical_id)
    else:
        TabularDatasetFactory(taiga_id=virtual_id)

    empty_db_mock_downloads.session.flush()

    if passes:
        taiga_id_loader.assert_loaded_db_taiga_ids_are_canonical()
    else:
        with pytest.raises(AssertionError):
            taiga_id_loader.assert_loaded_db_taiga_ids_are_canonical()


def test_load_interactive_canonical_taiga_ids(empty_db_mock_downloads):
    """
    Test that loads canonical taiga ids for taiga ids in
        normal interactive config
    """

    dep_taiga_id = "dep-dataset-id.1/file"
    custom_taiga_id = "custom-dataset-id.1/file"
    DependencyDatasetFactory(taiga_id=dep_taiga_id)

    CustomDatasetConfigFactory(
        config=json.dumps(
            {
                "label": "test label",
                "units": "test axis label",
                "data_type": "user_upload",
                "feature_name": "test feature",
                "is_standard": False,
                "transpose": False,
                "taiga_id": custom_taiga_id,
            }
        )
    )
    empty_db_mock_downloads.session.flush()
    # not calling reload_interactive_config, becuase it also calls load_interactive_canonical_taiga_ids, which we are testing (we want to call it explicitly)
    empty_db_mock_downloads.app._depmap_interactive_config = (
        InteractiveConfigFakeMutationsDownload()
    )  # make interactive config load the datasets we've just created with factories

    # verify setup
    assert TaigaAlias.get_canonical_taiga_id(dep_taiga_id, must=False) is None
    assert TaigaAlias.get_canonical_taiga_id(custom_taiga_id, must=False) is None

    taiga_id_loader.load_interactive_canonical_taiga_ids()

    assert TaigaAlias.get_canonical_taiga_id(dep_taiga_id) == dep_taiga_id
    assert TaigaAlias.get_canonical_taiga_id(custom_taiga_id) == custom_taiga_id
