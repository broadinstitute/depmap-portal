import pandas as pd

from depmap.dataset.models import DependencyDataset
from depmap.context.models import Context, ContextEntity, ContextEnrichment
from tests.factories import (
    CellLineFactory,
    ContextFactory,
    ContextEntityFactory,
    ContextEnrichmentFactory,
    GeneFactory,
    DependencyDatasetFactory,
    CompoundExperimentFactory,
)
from tests.utilities.df_test_utils import dfs_equal_ignoring_column_order


def test_get_all_names(empty_db_mock_downloads):
    context_1 = ContextFactory()
    context_2 = ContextFactory()
    empty_db_mock_downloads.session.flush()

    assert set(Context.get_all_names()) == {context_1.name, context_2.name}


def test_context_get_by_name(empty_db_mock_downloads):
    cell_line = CellLineFactory(tumor_type=None)
    context = ContextFactory(cell_line=[cell_line])
    empty_db_mock_downloads.session.flush()

    assert Context.get_by_name(context.name) == context


def test_context_entity_get_by_label(empty_db_mock_downloads):
    context_entity = ContextEntityFactory()
    empty_db_mock_downloads.session.flush()

    assert ContextEntity.get_by_label(context_entity.label) == context_entity


def test_get_cell_line_table_query(empty_db_mock_downloads):
    """
    Test that cell line is selected even if it's tumor_type is None
    :param empty_db_mock_downloads:
    :return: 
    """
    cell_line = CellLineFactory(tumor_type=None)
    context = ContextFactory(cell_line=[cell_line])
    empty_db_mock_downloads.session.flush()

    query = Context.get_cell_line_table_query(context.name)

    df = pd.read_sql(query.statement, query.session.connection())

    assert len(df) == 1
    assert df["cell_line_display_name"][0] == cell_line.cell_line_display_name
    assert df["primary_disease"][0] == cell_line.primary_disease.name
    assert df["tumor_type"][0] == None


def test_get_entities_enriched_in_context_query(empty_db_mock_downloads):
    gene_context_enrichment = ContextEnrichmentFactory()
    compound_context_enrichment = ContextEnrichmentFactory(
        context=gene_context_enrichment.context,
        entity=CompoundExperimentFactory(),
        dataset=DependencyDatasetFactory(name=DependencyDataset.DependencyEnum.GeCKO)
        # need to make this different, since the DependencyDatasetFactory defaults to avana
    )
    empty_db_mock_downloads.session.flush()

    query = ContextEnrichment.get_entities_enriched_in_context_query(
        gene_context_enrichment.context.name
    )

    df = pd.read_sql(query.statement, query.session.connection())
    assert len(df) == 2

    gene_row = df.loc[df["label"] == gene_context_enrichment.entity.label].iloc[0]
    assert gene_row["display_name"] == gene_context_enrichment.dataset.display_name
    assert gene_row["t_statistic"] == gene_context_enrichment.t_statistic
    assert gene_row["p_value"] == gene_context_enrichment.p_value

    compound_row = df.loc[df["label"] == compound_context_enrichment.entity.label].iloc[
        0
    ]
    assert (
        compound_row["url_label"] == compound_context_enrichment.entity.compound.label
    )


def test_get_enriched_context_cell_line_p_value_effect_size(empty_db_mock_downloads):
    """
    :return: a df where:
        index is context name
        columns are
            p_value (number)
            cell_line (*list* of cell line names)
    """
    cell_line_A1 = CellLineFactory(cell_line_name="cell_line_A1")
    cell_line_AB2 = CellLineFactory(cell_line_name="cell_line_AB2")
    cell_line_B3 = CellLineFactory(cell_line_name="cell_line_B3")
    cell_line_C4 = CellLineFactory(cell_line_name="cell_line_C4")

    context_A = ContextFactory(
        name="context_A", cell_line=[cell_line_A1, cell_line_AB2]
    )  # overlapping
    context_B = ContextFactory(
        name="context_B", cell_line=[cell_line_AB2, cell_line_B3]
    )
    context_C = ContextFactory(
        name="context_C", cell_line=[cell_line_C4]
    )  # one cell line, is still a list later

    entity = GeneFactory()
    dataset = (
        DependencyDatasetFactory()
    )  # for this query the entity/cell lines don't even need to be in the dataset

    ContextEnrichmentFactory(
        context=context_A, entity=entity, dataset=dataset, t_statistic=1
    )
    ContextEnrichmentFactory(
        context=context_B, entity=entity, dataset=dataset, t_statistic=1
    )
    ContextEnrichmentFactory(
        context=context_C, entity=entity, dataset=dataset, t_statistic=-1
    )

    empty_db_mock_downloads.session.flush()

    df = ContextEnrichment.get_enriched_context_cell_line_p_value_effect_size(
        entity.entity_id, dataset.dataset_id
    )

    expected = pd.DataFrame(
        {
            "p_value": [1e-5, 1e-5, 1e-5],
            "effect_size_means_difference": [0.5, 0.5, 0.5],
            "cell_line": [
                {cell_line_A1.depmap_id, cell_line_AB2.depmap_id},
                {cell_line_AB2.depmap_id, cell_line_B3.depmap_id},
                {cell_line_C4.depmap_id},
            ],
        },
        index=["context_A", "context_B", "context_C"],
        columns=["cell_line", "p_value", "effect_size_means_difference"],
    )

    assert dfs_equal_ignoring_column_order(df, expected)

    df = ContextEnrichment.get_enriched_context_cell_line_p_value_effect_size(
        entity.entity_id, dataset.dataset_id, negative_only=True
    )

    expected = pd.DataFrame(
        {
            "p_value": [1e-5],
            "effect_size_means_difference": [0.5],
            "cell_line": [{cell_line_C4.depmap_id}],
        },
        index=["context_C"],
        columns=["cell_line", "p_value", "effect_size_means_difference"],
    )
    assert dfs_equal_ignoring_column_order(df, expected)
