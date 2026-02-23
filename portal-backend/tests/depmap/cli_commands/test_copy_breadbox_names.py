from breadbox_client.models import MatrixDatasetResponse
from breadbox_facade import BBClient

from depmap.cli_commands.copy_breadbox_names import copy_breadbox_names
from unittest.mock import MagicMock, create_autospec

from depmap.dataset.models import DependencyDataset
from depmap.enums import DependencyEnum
from tests.factories import DependencyDatasetFactory
from depmap.extensions import db


def test_copy_breadbox_names(monkeypatch, empty_db_mock_downloads):
    mock_bb_client = create_autospec(BBClient)

    def mk_dataset(name: str, given_id: str):
        dataset = create_autospec(MatrixDatasetResponse)
        dataset.name = name
        dataset.given_id = given_id
        return dataset

    DependencyDatasetFactory(name=DependencyEnum.Avana, display_name="d1")
    DependencyDatasetFactory(name=DependencyEnum.Chronos_Achilles, display_name="d2")
    empty_db_mock_downloads.session.flush()

    mock_bb_client.get_datasets.return_value = [mk_dataset("d1_new_name", "Avana")]
    monkeypatch.setattr("depmap.extensions.breadbox.client", mock_bb_client)
    committed = False

    def mock_commit():
        nonlocal committed
        committed = True

    monkeypatch.setattr("depmap.extensions.db.session.commit", mock_commit)
    copy_breadbox_names(False)
    assert committed

    def check_name(value, expected):
        dataset = DependencyDataset.get_dataset_by_name(value)
        assert dataset is not None
        assert dataset.display_name == expected

    check_name(DependencyEnum.Avana.value, "d1_new_name")
    check_name(DependencyEnum.Chronos_Achilles.value, "d2")
