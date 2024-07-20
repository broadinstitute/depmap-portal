from depmap.enums import BiomarkerEnum
from depmap.entity.views.index import format_celfie, format_summary
from depmap.gene.views.index import format_summary_option
from tests.factories import (
    BiomarkerDatasetFactory,
    GeneFactory,
    DependencyDatasetFactory,
    MatrixFactory,
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


def test_format_celfie(empty_db_mock_downloads):
    dataset = DependencyDatasetFactory()
    gene = GeneFactory()
    matrix = MatrixFactory(entities=[gene])
    BiomarkerDatasetFactory(name=BiomarkerEnum.expression, matrix=matrix)
    BiomarkerDatasetFactory(name=BiomarkerEnum.copy_number_relative, matrix=matrix)
    BiomarkerDatasetFactory(name=BiomarkerEnum.mutations_damaging, matrix=matrix)
    BiomarkerDatasetFactory(name=BiomarkerEnum.mutations_hotspot, matrix=matrix)
    BiomarkerDatasetFactory(name=BiomarkerEnum.mutations_driver, matrix=matrix)
    empty_db_mock_downloads.session.flush()
    gene_symbol = gene.label

    celfie = format_celfie(gene_symbol, [dataset])
    for key in celfie:
        assert key in [
            "entity_name",
            "dependency_datasets",
            "similarity_options",
            "color_options",
            "connectivity_options",
            "datasets",
        ]
    assert celfie["entity_name"] == gene_symbol
