from depmap import data_access

from depmap.download.utils import get_download_url, __get_taiga_id_to_download_url
from loader import taiga_id_loader
from tests.depmap.utilities.test_url_utils import assert_url_contains_parts
from tests.factories import TaigaAliasFactory
from tests.utilities import interactive_test_utils


def test_get_download_url(_empty_db_base):
    """
    Integration test, testing that
        assuming that taiga aliases are correctly stored in the db

    """
    # these taiga ids are hardcoded in test settings, in test.py
    download_taiga_id = "small-avana-f2b9.2/avana_score"  # selected because unique, and because uses satisfies_db_taiga_id
    nonstandard_dataset_taiga_id = "small-avana-2987.2"  # from nonstandard
    canonical_taiga_id = "canonical-taiga-id.1/file"

    TaigaAliasFactory(taiga_id=download_taiga_id, canonical_taiga_id=canonical_taiga_id)
    TaigaAliasFactory(
        taiga_id=nonstandard_dataset_taiga_id, canonical_taiga_id=canonical_taiga_id
    )
    _empty_db_base.session.flush()

    # do this after creating the taiga alias factories
    # otherwise, the TaigaAlias for the download id will have the same taiga and canonical
    taiga_id_loader.load_in_memory_taiga_ids()
    interactive_test_utils.reload_interactive_config()  # this is needed because weused _empty_db_base

    download_url = get_download_url(
        data_access.get_dataset_taiga_id(nonstandard_dataset_taiga_id)
    )

    # manages to find the file
    # as hardcoded in test settings, this is the headliner2 file matching download_taiga_id
    assert_url_contains_parts(
        download_url,
        ["/download/all/", "release=test+name+version", "file=headliner2+file+name"],
    )


def test_get_taiga_id_to_download(empty_db_with_mutation_biomarker_dataset):
    taiga_id_to_download = __get_taiga_id_to_download_url()

    # this is all just testing an expected dict, but we need to test in parts because the url is not deterministic
    assert len(taiga_id_to_download) == 2
    assert (
        "small-avana-f2b9.2/avana_score" in taiga_id_to_download
    )  # hash by satisfies_db_taiga_id instead of taiga_id
    assert "test-taiga-id.1" in taiga_id_to_download

    assert_url_contains_parts(
        taiga_id_to_download["test-taiga-id.1"],
        ["/download/all/", "release=test+name+version", "file=test+file+name+2"],
    )
    assert_url_contains_parts(
        taiga_id_to_download["small-avana-f2b9.2/avana_score"],
        ["/download/all/", "release=test+name+version", "file=headliner2+file+name"],
    )
