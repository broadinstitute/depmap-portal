from depmap.vector_catalog.trees import InteractiveTree
from depmap.vector_catalog.models import SliceRowType
from tests.factories import DependencyDatasetFactory, GeneFactory
from tests.utilities import interactive_test_utils


def test_interactive_tree_get_dataset_feature_from_id(app, empty_db_mock_downloads):
    gene = GeneFactory()
    dataset = DependencyDatasetFactory()
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()
    expected = (dataset.name.name, gene.label)

    slice_entity_id = "slice/{}/{}/{}".format(
        dataset.name.name, gene.entity_id, SliceRowType.entity_id.name
    )
    assert InteractiveTree.get_dataset_feature_from_id(slice_entity_id) == expected

    slice_label_id = "slice/{}/{}/{}".format(
        dataset.name.name, gene.label, SliceRowType.label.name
    )
    assert InteractiveTree.get_dataset_feature_from_id(slice_label_id) == expected


def test_interactive_tree_get_id_from_dataset_feature(app, empty_db_mock_downloads):
    gene = GeneFactory()
    dataset = DependencyDatasetFactory()
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected = "slice/{}/{}/{}".format(
        dataset.name.name, gene.entity_id, SliceRowType.entity_id.name
    )

    # works if specify entity id
    assert (
        InteractiveTree.get_id_from_dataset_feature(
            dataset.name.name, gene.entity_id, feature_is_entity_id=True
        )
        == expected
    )

    # also works and converts to entity id if specify label
    assert (
        InteractiveTree.get_id_from_dataset_feature(
            dataset.name.name, gene.label, feature_is_entity_id=False
        )
        == expected
    )

    # keeps row_type as label if should not be translated to entity id (e.g. nonstandard without entity class)
    assert (
        InteractiveTree.get_id_from_dataset_feature(
            "small-avana-2987.2", "test", feature_is_entity_id=False
        )
        == "slice/small-avana-2987.2/test/label"
    )
