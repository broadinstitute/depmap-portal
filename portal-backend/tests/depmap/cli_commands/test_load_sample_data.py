import requests
from unittest.mock import Mock
from loader import nonstandard_private_loader, taiga_id_loader
from depmap.cli_commands.db_load_commands import load_sample_data
from tests.utilities.override_fixture import override
from depmap.read_config import read_config
from depmap.enums import DependencyEnum
import pytest


def config(request):
    """
    Override the default conftest config fixture
    """

    import os

    DevConfig = read_config(env_name="dev", config_path="../config/dev/settings.py")

    class TestDevConfig(DevConfig):
        ENV = "test-dev"
        AUTH_CONFIG_FILE = os.path.join(
            DevConfig.LOADER_DATA_DIR, "settings/access_control_config.py"
        )

    return TestDevConfig


def mock_ask_taiga_for_canonical_taiga_id(request, app, monkeypatch):
    """
    Replace the default test mock with one with some behavior for test data
    """

    def mock_function(taiga_id: str):
        # don't need to list all the virtuals, just that ones that are used in the load sample data process
        virtuals = {
            "small-avana-virtual-dataset-86d8.1/avana_score": "small-avana-f2b9.2/avana_score",
            "small-gecko-virtual-dataset-4fe6.1": "small-gecko-aff0.1/gecko_score",
            "small-gecko-aff0.1": "small-gecko-aff0.1/gecko_score",
        }
        if taiga_id in virtuals:
            return virtuals[taiga_id]

        return taiga_id

    monkeypatch.setattr(
        taiga_id_loader, "_ask_taiga_for_canonical_taiga_id", mock_function
    )
