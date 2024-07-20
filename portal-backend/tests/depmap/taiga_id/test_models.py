from depmap.taiga_id.models import TaigaAlias
from tests.factories import TaigaAliasFactory

virtual_taiga_id = "test-virtual.1/test"
canonical_taiga_id = "test-canonical.1/test"


def test_get_canonical_taiga_id(empty_db_mock_downloads):
    TaigaAliasFactory(taiga_id=virtual_taiga_id, canonical_taiga_id=canonical_taiga_id)
    TaigaAliasFactory(
        taiga_id=canonical_taiga_id, canonical_taiga_id=canonical_taiga_id
    )
    empty_db_mock_downloads.session.flush()

    assert TaigaAlias.get_canonical_taiga_id(virtual_taiga_id) == canonical_taiga_id
    assert TaigaAlias.get_canonical_taiga_id(canonical_taiga_id) == canonical_taiga_id


def test_taiga_id_is_canonical(empty_db_mock_downloads):
    TaigaAliasFactory(taiga_id=virtual_taiga_id, canonical_taiga_id=canonical_taiga_id)
    TaigaAliasFactory(
        taiga_id=canonical_taiga_id, canonical_taiga_id=canonical_taiga_id
    )
    empty_db_mock_downloads.session.flush()

    assert not TaigaAlias.taiga_id_is_canonical(virtual_taiga_id)
    assert TaigaAlias.taiga_id_is_canonical(canonical_taiga_id)
