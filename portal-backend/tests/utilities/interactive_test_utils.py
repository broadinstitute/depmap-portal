from flask import current_app
from loader.taiga_id_loader import load_interactive_canonical_taiga_ids
from tests.conftest import InteractiveConfigFakeMutationsDownload


def reload_interactive_config():
    current_app._depmap_interactive_config = (
        InteractiveConfigFakeMutationsDownload()
    )  # make interactive config load the datasets we've just created with factories
    load_interactive_canonical_taiga_ids()
