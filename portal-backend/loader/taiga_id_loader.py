from flask import current_app
from depmap.taiga_id.utils import get_taiga_client
from depmap.extensions import db
from depmap.dataset.models import Dataset, TabularDataset
from depmap.interactive.nonstandard.models import CustomDatasetConfig
from depmap.taiga_id.models import TaigaAlias
from depmap.interactive import interactive_utils
from depmap.utilities.iter import progressbar
import uuid

from depmap.settings.parse_downloads import get_taiga_ids_from_all_downloads


def load_in_memory_taiga_ids():
    """
    Loads aliases for taiga ids that are in configuration files
        The name refers to "load in-memory taiga-ids" not "load
taiga-ids into memory"
    """
    taiga_ids = get_taiga_ids_from_all_downloads()
    _load_canonical_taiga_ids(taiga_ids)


def assert_loaded_db_taiga_ids_are_canonical():
    """
    Taiga ids loaded into the database are expected to be canonical
    The conversion should have been done in their loaders
    Assert that it was done
    """
    datasets = Dataset.get_all_taiga_ids()
    tabular_datasets = TabularDataset.get_all_taiga_ids()
    loaded_db_taiga_ids = datasets + tabular_datasets

    not_canonical = []
    for taiga_id in loaded_db_taiga_ids:
        if not TaigaAlias.taiga_id_is_canonical(taiga_id):
            not_canonical.append(taiga_id)

    assert len(not_canonical) == 0, not_canonical


def load_interactive_canonical_taiga_ids():
    """
    Dataset versions are loaded first, because they are needed to figure out the dataset display name to load. Consequently, they are also needed for checking that versions are up to date
    Downloads are loaded with dataset versions because this is useful for test setup
    Dataset and TabularDataset taiga ids are loaded with their loaders (adder wrapper methods)
    Interactive config datasets are loaded after everything, including nonstandard datasets, have been loaded
    :return:
    """
    interactive = interactive_utils.get_all_original_taiga_ids()

    # taiga ids of all custom datasets are loaded
    # this is so that the .taiga_id property of an interactive Config object for a custom dataset works fine
    # listing all custom uuids is safe to do in the loader for the sake of just loading taiga aliases
    dangerous_all_custom_taiga_ids = []

    for dataset_id in CustomDatasetConfig._CAUTION_EXTRA_DANGEROUS_list_all_uuids():
        taiga_id = interactive_utils.get_original_taiga_id(dataset_id)
        if taiga_id is not None:
            dangerous_all_custom_taiga_ids.append(taiga_id)

    _load_canonical_taiga_ids(list(interactive) + dangerous_all_custom_taiga_ids)


def _load_canonical_taiga_ids(taiga_ids):
    print("Loading canonical taiga ids")
    with progressbar(total=len(taiga_ids)) as pbar:
        for taiga_id in taiga_ids:
            pbar.update(1)
            _ensure_canonical_id_stored(taiga_id)


def _ensure_canonical_id_stored(taiga_id: str):
    """
    :param taiga_client: an instance of TaigaClient or None. If None (only to be used in making mock data) it will create a record saying this taiga_id is the canonical one.
    :param taiga_id: The Taiga id to store in the database along with it's canonical ID
    :return: the canonical taiga id. this is only used for dataset loaders
    """
    assert taiga_id is not None
    canonical_taiga_id = TaigaAlias.get_canonical_taiga_id(taiga_id, must=False)
    if canonical_taiga_id is None:
        # Check if derived fake taiga id before querying taiga to bypass checking within Taiga if it is canonical.
        # NOTE: This should only be for datasets we've created within the portal such as mutations_prioritized
        if taiga_id.startswith("derived-data:"):
            canonical_taiga_id = taiga_id
        else:
            canonical_taiga_id = _ask_taiga_for_canonical_taiga_id(taiga_id)
        if taiga_id is None or canonical_taiga_id is None:
            raise Exception(
                f"Could not canonicalize taiga_id {taiga_id}, got canonical_taiga_id {canonical_taiga_id}"
            )
        # fake taiga ids that start with 'derived-data:' should also get added as a canonical taiga id
        db.session.add(
            TaigaAlias(taiga_id=taiga_id, canonical_taiga_id=canonical_taiga_id)
        )

    # ask whether the retrieved canonical taiga id has a canonical taiga id (it needs to register itself)
    # note the difference in input to get_canonical_taiga_id compared to the first block
    if TaigaAlias.get_canonical_taiga_id(canonical_taiga_id, must=False) is None:
        # here we don't have to ask, the canonical taiga id is itself
        db.session.add(
            TaigaAlias(
                taiga_id=canonical_taiga_id, canonical_taiga_id=canonical_taiga_id
            )
        )

    return canonical_taiga_id


def _ask_taiga_for_canonical_taiga_id(taiga_id: str):
    taiga_client = get_taiga_client()

    if current_app.config["ENV"] == "dev":
        # dev has some fake taiga ids
        # for these, we just alias to themselves
        fake_taiga_ids = {
            "placeholder-taiga-id.1",
            "placeholder-ctrp-id.1",
            "placeholder-gdsc-id.1",
            "test-taiga-id.1",
            "placeholder-onc-id.1",
            "fake-protein-taiga-id.1/file",
        }
        if taiga_id in fake_taiga_ids:
            return taiga_id
    return taiga_client.get_canonical_id(taiga_id)


def create_derived_taiga_id():
    """
    Create a fake unique taiga id. This should only be used in data loader for datasets we created 
    and is used to bypass having to upload the dataset in Taiga. 
    These fake taiga ids will need to bypass canonicalization.
    NOTE: This is intended to be a temporary solution for above cases until Breadbox can replace this constraint on taiga ids.
    """
    return "derived-data:" + str(uuid.uuid4())
