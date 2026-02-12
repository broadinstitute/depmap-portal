from depmap.entity.views.index import format_summary
from depmap.gene.views.index import format_summary_option
from tests.factories import (
    GeneFactory,
    DependencyDatasetFactory,
)


def test_format_summary(empty_db_mock_downloads):
    """
    Specifics are indirectly tested in test_format_gene_summary and test_format_compound_summary
    """
    dataset = DependencyDatasetFactory()
    gene = GeneFactory()
    empty_db_mock_downloads.session.flush()

    summary_options = [format_summary_option(dataset, gene, "test label")]
    summary = format_summary(summary_options, gene, dataset.name.name)

    for key in ["figure", "summary_options", "ajax_url"]:
        assert key in summary
