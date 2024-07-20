from depmap.partials.entity_summary.factories import get_entity_summary
from depmap.dataset.models import DependencyDataset, BiomarkerDataset, TabularDataset
from depmap.partials.entity_summary.models import EntitySummary
from tests.factories import (
    GeneFactory,
    MatrixFactory,
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    CellLineFactory,
    CompoundExperimentFactory,
    MutationFactory,
)
from tests.utilities import interactive_test_utils


def test_entity_summary(empty_db_mock_downloads):
    cell_line = CellLineFactory()
    gene = GeneFactory()

    dep_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])
    expression_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])
    mutations_prioritized_matrix = MatrixFactory(
        entities=[gene], cell_lines=[cell_line]
    )

    DependencyDatasetFactory(
        matrix=dep_matrix, name=DependencyDataset.DependencyEnum.Avana
    )
    BiomarkerDatasetFactory(
        matrix=expression_matrix, name=BiomarkerDataset.BiomarkerEnum.expression
    )
    BiomarkerDatasetFactory(
        matrix=mutations_prioritized_matrix,
        name=BiomarkerDataset.BiomarkerEnum.mutations_prioritized,
    )
    MutationFactory(gene=gene, cell_line=cell_line, variant_info="MISSENSE")
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_summary = get_entity_summary(
        gene,
        DependencyDataset.DependencyEnum.Avana.name,
        BiomarkerDataset.BiomarkerEnum.expression,
        BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
    )
    assert isinstance(entity_summary, EntitySummary)
    assert entity_summary.json_data() is not None


def test_compound_summary(empty_db_mock_downloads):
    cell_line = CellLineFactory()
    compound = CompoundExperimentFactory()

    dep_matrix = MatrixFactory(entities=[compound], cell_lines=[cell_line])

    DependencyDatasetFactory(
        matrix=dep_matrix, name=DependencyDataset.DependencyEnum.GDSC1_AUC
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_summary = get_entity_summary(
        compound, DependencyDataset.DependencyEnum.GDSC1_AUC.name, None, None
    )
    assert isinstance(entity_summary, EntitySummary)
    assert entity_summary.json_data() is not None
