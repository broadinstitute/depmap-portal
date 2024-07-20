from depmap.correlation.utils import get_all_correlations, _query_correlates

from depmap.dataset.models import DependencyDataset
from tests.factories import (
    CorrelationFactory,
    GeneFactory,
    DependencyDatasetFactory,
    MatrixFactory,
)


def assert_cols_rows_expected(df, expected_cols, expected_rows_for_select_columns):
    """
    :param expected_rows_for_select_columns: for the columns other_entity_label, other_dataset, fit_type
    """
    assert set(df.columns) == set(expected_cols)
    rows_cols_to_verify = [
        (x["other_entity_label"], x["other_dataset"])
        for x in df.to_records(index=False)
    ]
    # Test list equality irrespective or order, expecting duplicates
    assert sorted(rows_cols_to_verify) == sorted(
        expected_rows_for_select_columns
    ), print(rows_cols_to_verify, expected_rows_for_select_columns, sep="\n")


def test_get_all_correlations(tmpdir, empty_db_mock_downloads):
    gene_1 = GeneFactory()
    gene_2 = GeneFactory()
    genes = [gene_1, gene_2]

    matrix_1 = MatrixFactory(entities=genes)
    matrix_2 = MatrixFactory(entities=genes)

    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana, matrix=matrix_1
    )
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GeCKO, matrix=matrix_2
    )

    cor1_filename = str(tmpdir.join("cor.sqlite3"))
    #    create_correlation_file(cor1_filename, cor_values=[[1.0, None], [0.9, 1.0]])

    cor2_filename = str(tmpdir.join("cor2.sqlite3"))
    #    create_correlation_file(cor2_filename, cor_values=[[0.9, 0.2], [0.3, 1.0]])

    CorrelationFactory(
        dataset_1=dataset_1,
        dataset_2=dataset_1,
        filename=cor1_filename,
        cor_values=[[1.0, None], [0.9, 1.0]],
    )
    CorrelationFactory(
        dataset_1=dataset_1,
        dataset_2=dataset_2,
        filename=cor2_filename,
        cor_values=[[0.9, 0.2], [0.3, 1.0]],
    )

    empty_db_mock_downloads.session.flush()

    # Test get_associations_and_association_features
    df_combined = get_all_correlations(dataset_1.matrix.matrix_id, gene_1.label)
    expected_cols = [
        "correlation",
        "other_entity_label",
        "other_dataset",
        "other_dataset_name",
        "other_dataset_id",
    ]
    expected_combined_rows = [
        (gene_2.label, dataset_1.display_name),
        (gene_1.label, dataset_2.display_name),
        (gene_2.label, dataset_2.display_name),
    ]
    assert_cols_rows_expected(df_combined, expected_cols, expected_combined_rows)


def test_query_self_correlates(tmpdir, empty_db_mock_downloads):
    genes = [GeneFactory() for _ in range(3)]
    matrix_0 = MatrixFactory(entities=genes)
    dataset_0 = DependencyDatasetFactory(
        display_name="d0",
        name=DependencyDataset.DependencyEnum.RNAi_merged,
        matrix=matrix_0,
    )

    cor_filename = str(tmpdir.join("cor.sqlite3"))
    cor_values = [[1.0, None, None], [0.5, 1.0, None], [0.9, 0.1, 1.0]]
    CorrelationFactory(dataset_0, dataset_0, cor_filename, cor_values)

    empty_db_mock_downloads.session.flush()

    # setup of mock data ends here
    # now, to test _query_correlates

    cor_recs_0 = _query_correlates(
        genes[0].entity_id, dataset_0.dataset_id, dataset_0.dataset_id, 100
    )
    assert [x.cor for x in cor_recs_0] == [0.9, 0.5]

    cor_recs_0 = _query_correlates(
        genes[1].entity_id, dataset_0.dataset_id, dataset_0.dataset_id, 100
    )
    assert [x.cor for x in cor_recs_0] == [0.5, 0.1]

    cor_recs_0 = _query_correlates(
        genes[2].entity_id, dataset_0.dataset_id, dataset_0.dataset_id, 100
    )
    assert [x.cor for x in cor_recs_0] == [0.9, 0.1]


def test_query_correlates(tmpdir, empty_db_mock_downloads):
    genes = [GeneFactory() for _ in range(3)]
    matrix_0 = MatrixFactory(entities=genes)
    dataset_0 = DependencyDatasetFactory(
        display_name="d0",
        name=DependencyDataset.DependencyEnum.RNAi_merged,
        matrix=matrix_0,
    )
    matrix_1 = MatrixFactory(entities=genes)
    dataset_1 = DependencyDatasetFactory(
        display_name="d1", name=DependencyDataset.DependencyEnum.Avana, matrix=matrix_1
    )

    cor_filename = str(tmpdir.join("cor.sqlite3"))
    cor_values = [[1.0, 0.0, -0.99], [0.5, -0.5, 0.15], [0.9, 0.1, -0.8]]
    CorrelationFactory(dataset_0, dataset_1, cor_filename, cor_values)
    empty_db_mock_downloads.session.flush()

    # setup of mock data ends here
    # now, to test _query_correlates

    # check case where dataset is first dimension
    cor_recs_0 = _query_correlates(
        genes[0].entity_id, dataset_0.dataset_id, dataset_1.dataset_id, 2
    )
    assert len(cor_recs_0) == 2
    assert [x.cor for x in cor_recs_0] == [1, -0.99]

    # check case where dataset is second dimension
    cor_recs_1 = _query_correlates(
        genes[0].entity_id, dataset_1.dataset_id, dataset_0.dataset_id, 2
    )
    assert [x.cor for x in cor_recs_1] == [1, 0.9]

    # check case where limit > the number of records in correlation table
    cor_recs_1 = _query_correlates(
        genes[0].entity_id, dataset_1.dataset_id, dataset_0.dataset_id, 10
    )
    assert [x.cor for x in cor_recs_1] == [1, 0.9, 0.5]
