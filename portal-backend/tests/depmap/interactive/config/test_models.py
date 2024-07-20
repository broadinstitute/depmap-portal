from flask import current_app
from depmap.gene.models import Gene
from depmap.dataset.models import DependencyDataset
from depmap.interactive.config.models import _format_common_dataset_metadata, Config
from depmap.access_control import PUBLIC_ACCESS_GROUP, assume_user
from depmap.utilities.exception import InteractiveDatasetNotFound
import pytest
from tests.utilities.access_control import get_canary_group_id
from tests.conftest import InteractiveConfigFakeMutationsDownload
from tests.depmap.interactive.fixtures import (
    nonstandard_aliased_dataset_id,
    nonstandard_nonaliased_dataset_id,
)
from tests.factories import (
    CustomDatasetConfigFactory,
    GeneFactory,
    CompoundExperimentFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    TaigaAliasFactory,
    PrivateDatasetMetadataFactory,
    NonstandardMatrixFactory,
)
from tests.utilities import interactive_test_utils


def test_config_taiga_id_property(empty_db_mock_downloads):
    """
    Test that
        .taiga_id returns canonical taiga id
        .original_taiga_id returns whatever the original is (not necessarily the canonical)
        both can handle None
    """
    virtual_taiga_id = "virtual.1/file"
    canonical_taiga_id = "canonical.1/file"
    TaigaAliasFactory(taiga_id=virtual_taiga_id, canonical_taiga_id=canonical_taiga_id)
    empty_db_mock_downloads.session.flush()

    config = Config(
        "test label",
        "test feature name",
        "user_upload",
        transpose=False,
        taiga_id=virtual_taiga_id,
    )
    assert config.taiga_id == canonical_taiga_id
    assert config.original_taiga_id == virtual_taiga_id

    # test that computed taiga_id property can handle None
    config_none_taiga_id = Config(
        "test label", "test feature name", "user_upload", transpose=False, taiga_id=None
    )
    assert config_none_taiga_id.taiga_id == None
    assert config_none_taiga_id.original_taiga_id == None


def test_format_common_dataset_metadata(empty_db_mock_downloads):
    """
    The entity_type field is used as keys to the depmapUrls dictionary for standard datasets
    This test is here so that they do not change without thought
    """
    dataset_gene = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[GeneFactory()]),
        name=DependencyDataset.DependencyEnum.Avana,
    )
    dataset_compound = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[CompoundExperimentFactory()]),
        name=DependencyDataset.DependencyEnum.GDSC1_AUC,
    )

    empty_db_mock_downloads.session.flush()

    assert _format_common_dataset_metadata(dataset_gene)["entity_type"] == "gene"
    assert (
        _format_common_dataset_metadata(dataset_compound)["entity_type"]
        == "compound_experiment"
    )


def test_nonstandard_noncustom_and_custom_datasets_are_joined(
    interactive_db_mock_downloads,
):
    """
    Test that nonstandard noncustom and custom datasets are joined
    """
    custom_config = CustomDatasetConfigFactory()
    interactive_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()
    config = InteractiveConfigFakeMutationsDownload()
    # is not listable, even though they are joined
    assert custom_config.uuid not in config.all_datasets
    # but we can retrieve the individual config
    assert config.get(custom_config.uuid) is not None

    # nonstandard noncustom are in all_datasets
    for key in [
        "Avana",
        nonstandard_aliased_dataset_id,
        nonstandard_nonaliased_dataset_id,
    ]:
        assert key in config.all_datasets


def test_private_datasets_are_not_cached(empty_db_mock_downloads):
    CANARY_GROUP_ID = get_canary_group_id()
    private_dataset = PrivateDatasetMetadataFactory(
        owner_id=CANARY_GROUP_ID, is_transpose=False
    )
    gene = GeneFactory()
    NonstandardMatrixFactory(
        private_dataset.dataset_id, owner_id=CANARY_GROUP_ID, entities=[gene]
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()
    config = InteractiveConfigFakeMutationsDownload()
    dataset_id = private_dataset.dataset_id

    with assume_user("canary@canary.com"):
        assert len(config.get_allowed_private_datasets()) == 1
        expected = {
            "is_discoverable": True,
            "is_standard": False,
            "is_private": True,
            "is_continuous": True,
            "prepopulate": False,
            "private_group_display_name": "Canary",
            "label": private_dataset.display_name,
            "feature_name": private_dataset.feature_name,
            "units": private_dataset.units,
            "transpose": private_dataset.is_transpose,
            "data_type": "user_upload",
        }
        assert config.get(dataset_id) == Config(**expected)

    # tested that it cannot be accessed even though we accessed it before
    assert len(config.get_allowed_private_datasets()) == 0
    with pytest.raises(InteractiveDatasetNotFound):
        assert config.get(dataset_id)


def test_get_allowed_private_datasets(interactive_db_mock_downloads):
    CANARY_GROUP_ID = get_canary_group_id()
    private_dataset_1 = PrivateDatasetMetadataFactory(
        owner_id=PUBLIC_ACCESS_GROUP, is_transpose=True
    )
    private_dataset_2 = PrivateDatasetMetadataFactory(
        owner_id=PUBLIC_ACCESS_GROUP, is_transpose=False
    )
    private_dataset_3 = PrivateDatasetMetadataFactory(
        owner_id=CANARY_GROUP_ID, is_transpose=False
    )

    gene = GeneFactory()
    NonstandardMatrixFactory(
        private_dataset_1.dataset_id, owner_id=PUBLIC_ACCESS_GROUP, entities=[gene]
    )
    NonstandardMatrixFactory(
        private_dataset_2.dataset_id, owner_id=PUBLIC_ACCESS_GROUP, entities=[gene]
    )
    NonstandardMatrixFactory(
        private_dataset_3.dataset_id, owner_id=CANARY_GROUP_ID, entities=[gene]
    )
    interactive_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()
    config = InteractiveConfigFakeMutationsDownload()

    all_private_datasets = config.get_allowed_private_datasets()
    assert len(all_private_datasets) == 2
    config_1 = all_private_datasets[private_dataset_1.dataset_id]
    config_2 = all_private_datasets[private_dataset_2.dataset_id]

    base_expected = {
        "is_discoverable": True,
        "is_standard": False,
        "is_private": True,
        "is_continuous": True,
        "prepopulate": False,
        "private_group_display_name": "Public",
    }

    expected_1 = {
        **base_expected,
        "label": private_dataset_1.display_name,
        "feature_name": private_dataset_1.feature_name,
        "units": private_dataset_1.units,
        "transpose": private_dataset_1.is_transpose,
        "data_type": "user_upload",
    }
    assert config_1 == Config(**expected_1)

    expected_2 = {
        **base_expected,
        "label": private_dataset_2.display_name,
        "feature_name": private_dataset_2.feature_name,
        "units": private_dataset_2.units,
        "transpose": private_dataset_2.is_transpose,
        "data_type": "user_upload",
    }
    assert config_2 == Config(**expected_2)

    with assume_user("canary@canary.com"):
        all_private_datasets = config.get_allowed_private_datasets()
        assert len(all_private_datasets) == 3


def test_nonstandard_dataset_entity_type(interactive_db_mock_downloads):
    """
    The entity field is translated into an entity_type string that is used as keys to the depmapUrls dictionary for nonstandard datasets
    This test is here so that they do not change without thought
    """
    config = InteractiveConfigFakeMutationsDownload()
    assert (
        current_app.config["GET_NONSTANDARD_DATASETS"]()[
            nonstandard_aliased_dataset_id
        ]["entity"]
        == Gene
    )
    assert config.get(nonstandard_aliased_dataset_id)["entity_class_name"] == "gene"

    assert (
        "entity"
        not in current_app.config["GET_NONSTANDARD_DATASETS"]()[
            nonstandard_nonaliased_dataset_id
        ]
    )
    assert config.get(nonstandard_nonaliased_dataset_id).entity_type == "Gene"
