from depmap.transcription_start_site.models import TranscriptionStartSite
from tests.factories import TranscriptionStartSiteFactory, GeneFactory


def test_get_from_gene_symbol_gene_id(empty_db_mock_downloads):
    gene_in = GeneFactory()
    tss_1 = TranscriptionStartSiteFactory(gene=gene_in)
    tss_2 = TranscriptionStartSiteFactory(gene=gene_in)
    TranscriptionStartSiteFactory(gene=GeneFactory())  # should not be retrieved
    empty_db_mock_downloads.session.flush()

    assert TranscriptionStartSite.query.count() == 3

    expected = {tss_1, tss_2}

    assert set(TranscriptionStartSite.get_from_gene_id(gene_in.entity_id)) == expected
    assert set(TranscriptionStartSite.get_from_gene_symbol(gene_in.label)) == expected
