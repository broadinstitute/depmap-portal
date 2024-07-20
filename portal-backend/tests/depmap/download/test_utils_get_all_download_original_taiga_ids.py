import pytest
from flask import current_app
from depmap.taiga_id.models import TaigaAlias
from tests.factories import TaigaAliasFactory
from depmap.settings.download_settings import get_download_list


@pytest.fixture(scope="function")
def _empty_db_taiga_aliases_loaded(_empty_db_base):
    # mock out the loading of in-memory taiga ids
    pass  # don't do anything
    yield _empty_db_base
