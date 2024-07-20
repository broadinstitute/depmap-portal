from typing import List
from depmap.interactive import common_utils
from depmap.interactive.common_utils import RowSummary
from depmap.download.tasks import (
    _get_mutation_table_entity_ids,
    get_merged_processed_df,
    get_processed_df,
    get_processed_mutations_df,
)
from depmap.dataset.models import DependencyDataset
from depmap.partials.data_table.factories import MutationTableSpec
from tests.factories import (
    GeneFactory,
    MatrixFactory,
    CellLineFactory,
    DependencyDatasetFactory,
    MutationFactory,
)
from tests.utilities import interactive_test_utils
from depmap.utilities.exception import UserError
import pandas as pd


def _get_transposed_df(df: pd.DataFrame) -> pd.DataFrame:
    return df.transpose()


def test_get_processed_mutations_df(empty_db_mock_downloads):
    genes = [GeneFactory(label="gene_" + str(i)) for i in range(3)]
    cell_lines = [CellLineFactory(depmap_id="cell_line_" + str(i)) for i in range(3)]
    mutation1 = MutationFactory(gene=genes[0], cell_line=cell_lines[0])
    mutation2 = MutationFactory(gene=genes[0], cell_line=cell_lines[1])
    mutation3 = MutationFactory(gene=genes[1], cell_line=cell_lines[1],)
    mutation4 = MutationFactory(gene=genes[2], cell_line=cell_lines[2])

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_ids = [gene.entity_id for gene in genes]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    entity_ids = MutationTableSpec.get_all_mutation_gene_ids()
    df = get_processed_mutations_df(entity_ids, [], progress_callback, chunk_size=2,)

    # Get entire nonsubsetted mutation table from Custom Downloads page
    non_subsetted_df = _get_transposed_df(df)
    assert non_subsetted_df["depmap_id"].tolist() == [
        "cell_line_0",
        "cell_line_1",
        "cell_line_1",
        "cell_line_2",
    ]

    assert non_subsetted_df["gene"].tolist() == ["gene_0", "gene_0", "gene_1", "gene_2"]

    # Subset by cell lines only
    subset_cell_lines_df = get_processed_mutations_df(
        entity_ids, ["cell_line_1",], progress_callback, chunk_size=2,
    )

    subsetted_by_cell_lines_df = _get_transposed_df(subset_cell_lines_df)

    assert subsetted_by_cell_lines_df["depmap_id"].tolist() == [
        "cell_line_1",
        "cell_line_1",
    ]

    assert subsetted_by_cell_lines_df["gene"].tolist() == ["gene_0", "gene_1"]
    # Subset by genes only
    entity_ids = _get_mutation_table_entity_ids(entity_labels=["gene_1"])
    subset_genes_df = get_processed_mutations_df(
        entity_ids, [], progress_callback, chunk_size=2,
    )

    subsetted_by_gene_df = _get_transposed_df(subset_genes_df)

    assert subsetted_by_gene_df["depmap_id"].tolist() == ["cell_line_1"]
    assert subsetted_by_gene_df["gene"].tolist() == ["gene_1"]

    # Subset using values that don't make sense
    gibberish_df = get_processed_mutations_df(
        ["bla", "bla"], [], progress_callback, chunk_size=2,
    )
    assert gibberish_df.size == 0

    # Subset the mutation table by both genes and cell lines
    entity_ids = _get_mutation_table_entity_ids(entity_labels=["gene_2"])
    subset_by_both_df = get_processed_mutations_df(
        entity_ids, ["cell_line_2"], progress_callback, chunk_size=2,
    )

    subsetted_by_both_df = _get_transposed_df(subset_by_both_df)
    assert subsetted_by_both_df["depmap_id"].values.tolist() == ["cell_line_2"]
    assert subsetted_by_both_df["gene"].values.tolist() == ["gene_2"]


def test_get_processed_df(empty_db_mock_downloads):
    genes = [GeneFactory(label="gene_" + str(i)) for i in range(9)]
    cell_lines = [CellLineFactory(depmap_id="cell_line_" + str(i)) for i in range(9)]
    num_cols = len(cell_lines)
    num_rows = len(genes)
    df = pd.DataFrame()
    for i in range(num_cols):
        df[i] = [j + i / 10 for j in range(num_rows)]

    dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(entities=genes, cell_lines=cell_lines, data=df.values),
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_labels = [gene.label for gene in genes]
    cell_line_ids = [cell.depmap_id for cell in cell_lines]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_processed_df(
        dataset.name.name,
        entity_labels,
        cell_line_ids,
        progress_callback,
        chunk_size=2,
    )

    expected_df = df.transpose()
    expected_df.columns = [gene.label for gene in genes]
    expected_df.index = [cell.depmap_id for cell in cell_lines]
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 36, 54, 72, 90]


def _get_expected_merged_process_df_variables(empty_db_mock_downloads):
    genes = [GeneFactory(label="gene_" + str(i)) for i in range(9)]
    cell_lines = [CellLineFactory(depmap_id="cell_line_" + str(i)) for i in range(9)]
    num_cols = len(cell_lines)
    num_rows = len(genes)
    df_single = pd.DataFrame()

    for i in range(num_cols):
        df_single[i] = [j + i / 10 for j in range(num_rows)]

    df = pd.concat([df_single, df_single])
    dataset_avana = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(
            entities=genes, cell_lines=cell_lines, data=df_single.values
        ),
    )

    dataset_achilles = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles,
        matrix=MatrixFactory(
            entities=genes, cell_lines=cell_lines, data=df_single.values
        ),
    )

    dataset_ids = [dataset_avana.name.name, dataset_achilles.name.name]

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_id_single_list = [gene.label for gene in genes]

    # Entity_ids is a list of lists. There should be 1 list of entity_ids per dataset
    # to be merged. Row_summaries is also a list of lists, of length equal to the number
    # of datasets to be merged.
    entity_ids = [entity_id_single_list, entity_id_single_list]

    # Datasets are merged on depmap_id, which is why cell_line_ids is NOT a list of lists
    cell_line_ids = [cell.depmap_id for cell in cell_lines]

    expected_variables = {
        "dataset_ids": dataset_ids,
        "entity_labels": entity_ids,
        "cell_line_ids": cell_line_ids,
        "dataset_avana": dataset_avana,
        "dataset_achilles": dataset_achilles,
        "cell_lines": cell_lines,
        "genes": genes,
        "df": df,
    }

    return expected_variables


def test_get_merged_processed_df(empty_db_mock_downloads):
    expected = _get_expected_merged_process_df_variables(empty_db_mock_downloads)
    dataset_ids = expected["dataset_ids"]
    entity_labels = expected["entity_labels"]
    cell_line_ids = expected["cell_line_ids"]
    dataset_avana = expected["dataset_avana"]
    dataset_achilles = expected["dataset_achilles"]
    cell_lines = expected["cell_lines"]
    genes = expected["genes"]
    df = expected["df"]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        dataset_ids, entity_labels, cell_line_ids, progress_callback, chunk_size=2,
    )

    expected_df = df.transpose()

    expected_column_list = [
        f"{dataset_avana.name.name} display name {gene.label}" for gene in genes
    ] + [f"{dataset_achilles.name.name} display name {gene.label}" for gene in genes]
    expected_df.columns = expected_column_list
    expected_df.index = [cell.depmap_id for cell in cell_lines]
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


def test_get_merged_processed_df_custom_gene_list(empty_db_mock_downloads):
    expected = _get_expected_merged_process_df_variables(empty_db_mock_downloads)
    dataset_ids = expected["dataset_ids"]
    entity_labels = expected["entity_labels"]
    cell_line_ids = expected["cell_line_ids"]
    dataset_avana = expected["dataset_avana"]
    dataset_achilles = expected["dataset_achilles"]
    cell_lines = expected["cell_lines"]
    genes = expected["genes"]
    df = expected["df"]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    # Test custom gene list
    processed_df = get_merged_processed_df(
        dataset_ids,
        [[entity_labels[0][0]], [entity_labels[0][0]]],
        cell_line_ids,
        progress_callback,
        chunk_size=2,
    )

    expected_df = df.transpose()

    column_list = [
        f"{dataset_avana.name.name} display name {gene.label}" for gene in genes
    ] + [f"{dataset_achilles.name.name} display name {gene.label}" for gene in genes]
    expected_df.columns = column_list

    # Only look at the expected dataframe with the 2 gene columns of interest
    dataset_achilles_col_name = (
        f"{dataset_achilles.name.name} display name {genes[0].label}"
    )
    dataset_avana_col_name = f"{dataset_avana.name.name} display name {genes[0].label}"
    expected_df = expected_df[[dataset_avana_col_name, dataset_achilles_col_name]]

    expected_df.index = [cell.depmap_id for cell in cell_lines]
    assert processed_df.equals(expected_df)


def test_get_merged_processed_df_custom_cell_line_list(empty_db_mock_downloads):
    expected = _get_expected_merged_process_df_variables(empty_db_mock_downloads)
    dataset_ids = expected["dataset_ids"]
    entity_labels = expected["entity_labels"]
    cell_line_ids = expected["cell_line_ids"]
    dataset_avana = expected["dataset_avana"]
    dataset_achilles = expected["dataset_achilles"]
    cell_lines = expected["cell_lines"]
    genes = expected["genes"]
    df = expected["df"]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        dataset_ids,
        entity_labels,
        [cell_line_ids[0]],  # Get 1 specific cell_line per dataset
        progress_callback,
        chunk_size=2,
    )

    expected_df = df.transpose()
    expected_df = expected_df[:1]

    expected_column_list = [
        f"{dataset_avana.name.name} display name {gene.label}" for gene in genes
    ] + [f"{dataset_achilles.name.name} display name {gene.label}" for gene in genes]
    expected_df.columns = expected_column_list
    expected_df.index = [cell_lines[0].depmap_id]
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


# If a custom gene/compound list is used for dataset merging, the entities in the list might not exist in every selected dataset.
# If at least 1 dataset has entity information, proceed as usual, leaving any dataset without ANY matching entity id's
# off of the resulting merged file.
def test_get_merged_processed_df_datasets_without_entities(empty_db_mock_downloads):
    genes = [GeneFactory(label="gene_" + str(i)) for i in range(9)]
    cell_lines = [CellLineFactory(depmap_id="cell_line_" + str(i)) for i in range(9)]
    num_cols = len(cell_lines)
    num_rows = len(genes)
    df_single = pd.DataFrame()

    for i in range(num_cols):
        df_single[i] = [j + i / 10 for j in range(num_rows)]

    df = pd.concat([df_single, df_single, pd.DataFrame()])
    dataset_avana = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana,
        matrix=MatrixFactory(
            entities=genes, cell_lines=cell_lines, data=df_single.values
        ),
    )

    dataset_achilles = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles,
        matrix=MatrixFactory(
            entities=genes, cell_lines=cell_lines, data=df_single.values
        ),
    )

    dataset_compound = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC,
        matrix=MatrixFactory(
            entities=None, cell_lines=cell_lines, data=df_single.values
        ),
    )

    dataset_ids = [
        dataset_avana.name.name,
        dataset_achilles.name.name,
        dataset_compound.name.name,
    ]

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_id_single_list = [gene.label for gene in genes]

    # In this situation, the user chooses a list with genes only, but includes a single compound dataset in the datasets
    # to be merged. The compound dataset is represented by [] because in depmap/download/tasks.py, _get_entity_ids
    # will return an empty list when it searches for genes in a compound dataset
    entity_ids = [entity_id_single_list, entity_id_single_list, []]

    cell_line_ids = [cell.depmap_id for cell in cell_lines]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    processed_df = get_merged_processed_df(
        dataset_ids, entity_ids, cell_line_ids, progress_callback, chunk_size=2,
    )

    expected_df = df.transpose()

    expected_column_list = [
        f"{dataset_avana.name.name} display name {gene.label}" for gene in genes
    ] + [f"{dataset_achilles.name.name} display name {gene.label}" for gene in genes]
    expected_df.columns = expected_column_list
    expected_df.index = [cell.depmap_id for cell in cell_lines]
    assert processed_df.equals(expected_df)
    assert recorded_progress == [18, 27, 36, 45, 54, 62, 72, 81, 90, 90]


# If no entities/features are present, let error bubble to top so React can display a generic message to the user
def test_get_merged_processed_df_no_info(empty_db_mock_downloads):
    genes = []
    cell_lines = []
    dataset_ids = [
        DependencyDataset.DependencyEnum.Avana.name,
        DependencyDataset.DependencyEnum.Chronos_Achilles.name,
    ]

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_id_single_list = [gene.entity_id for gene in genes]

    # Entity_ids is a list of lists. There should be 1 list of entity_ids per dataset
    # to be merged. Row_summaries is also a list of lists, of length equal to the number
    # of datasets to be merged.
    entity_ids = [entity_id_single_list, entity_id_single_list]

    # Datasets are merged on depmap_id, which is why cell_line_ids is NOT a list of lists
    cell_line_ids = [cell.depmap_id for cell in cell_lines]

    # Keep track of calculated percentages
    recorded_progress = []

    def progress_callback(percentage):
        recorded_progress.append(percentage)

    error_message = ""
    try:
        processed_df = get_merged_processed_df(
            dataset_ids, entity_ids, cell_line_ids, progress_callback, chunk_size=2,
        )
    except UserError:
        error_message = "The chosen genes, compounds, or cell lines do not exist in the selected datasets. Nothing to export."

    assert (
        error_message
        == "The chosen genes, compounds, or cell lines do not exist in the selected datasets. Nothing to export."
    )
