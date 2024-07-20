import uuid
from depmap.interactive.nonstandard.models import CustomDatasetConfig, NonstandardMatrix
from tests.factories import GeneFactory, NonstandardMatrixFactory


def test_nonstandard_matrix_find_dataset_ids_with_entity_ids(empty_db_mock_downloads):
    genes = GeneFactory.create_batch(2)

    dataset_1 = NonstandardMatrixFactory("test 1", entities=[genes[0]])
    dataset_2 = NonstandardMatrixFactory("test 2", entities=[genes[1]])
    NonstandardMatrixFactory("test 3")

    empty_db_mock_downloads.session.flush()

    assert set(
        NonstandardMatrix.find_dataset_ids_with_entity_ids(
            [gene.entity_id for gene in genes]
        )
    ) == {dataset_1.nonstandard_dataset_id, dataset_2.nonstandard_dataset_id}


def test_custom_dataset_config_add_get_all_exists_get(empty_db_mock_downloads):
    assert CustomDatasetConfig.query.count() == 0

    uuid_obj = uuid.UUID(
        int=16
    )  # this variable cannot be named uuid; it would mask the uuid module
    config = {
        "label": "test label",
        "units": "test axis label",
        "feature_name": "test feature",
        "is_custom": True,
        "is_continuous": True,
        "transpose": False,
    }

    # test exists false
    uuid_str = str(uuid_obj)
    assert not CustomDatasetConfig.exists(uuid_str)

    # test add
    CustomDatasetConfig.add(uuid_str, config)
    assert CustomDatasetConfig.query.count() == 1

    # test exists true
    assert CustomDatasetConfig.exists(uuid_str)

    # test get
    assert CustomDatasetConfig.get(uuid_str) == config
