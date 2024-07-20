from io import StringIO

import pandas as pd
from flask import url_for

from depmap.database import db
from tests.factories import (
    DepmapModelFactory,
    MutationFactory,
    BiomarkerDatasetFactory,
    GeneFactory,
    CellLineFactory,
    MatrixFactory,
    DatasetFactory,
)
from depmap.dataset.models import BiomarkerDataset, Dataset
from tests.utilities import interactive_test_utils
from depmap.partials.entity_summary.factories import get_entity_summary
from depmap.partials.entity_summary.models import EntitySummary


def test_data_table_download(app, empty_db_mock_downloads):
    """
    Just test that some table (in this case mutation) will spit out a csv, that can be then read by pandas
    mutation_by_gene has a filename that uses the dictionary
    """
    gene = GeneFactory(label="test_gene")
    mutation = MutationFactory(gene=gene)
    db.session.flush()
    entity_id = mutation.gene.entity_id

    with app.test_client() as c:
        r = c.get(
            url_for(
                "partials.data_table_download",
                type="mutation_by_gene",
                gene_id=entity_id,
            )
        )
        assert r.status_code == 200, r.status_code
        df = pd.read_csv(StringIO(r.data.decode("utf-8")))
        assert len(df) == 1

        expected_filename = "test_gene mutations"
        assert (
            "filename={}.csv".format(expected_filename)
            in r.headers["Content-Disposition"]
        )


def test_data_table_download_string_filename(app, empty_db_mock_downloads):
    """
    The above mutation_by_gene table has a filename that uses the dictionary
    Test a data table that just inputs a string as the filename
    """
    cell_line = DepmapModelFactory()
    empty_db_mock_downloads.session.flush()
    cell_line_display_name = cell_line.stripped_cell_line_name
    with app.test_client() as c:
        r = c.get(
            url_for(
                "partials.data_table_download",
                type="fusion_by_cell_line",
                model_id=cell_line.model_id,
            )
        )
        assert r.status_code == 200, r.status_code

    expected_filename = "{} fusions".format(cell_line_display_name)
    assert (
        "filename={}.csv".format(expected_filename) in r.headers["Content-Disposition"]
    )


def test_entity_data_download(app, empty_db_mock_downloads):
    """
    Tests that endpoint outputs a csv, that can be then read by pandas
    The expected filename should be the gene with the dependency dataset name
    """
    cell_line = CellLineFactory()
    gene = GeneFactory()

    expression_matrix = MatrixFactory(entities=[gene], cell_lines=[cell_line])

    BiomarkerDatasetFactory(
        matrix=expression_matrix, name=BiomarkerDataset.BiomarkerEnum.expression
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    dataset_enum_name = BiomarkerDataset.BiomarkerEnum.expression.name

    entity_summary = get_entity_summary(gene, dataset_enum_name, None, None,)
    assert isinstance(entity_summary, EntitySummary)
    assert entity_summary.download_data() is not None
    with app.test_client() as c:
        res = c.get(
            url_for(
                "partials.entity_summary_download",
                entity_id=entity_summary.entity_id,
                dep_enum_name=dataset_enum_name,
                size_biom_enum_name="none",
                color="none",
            )
        )
        assert res.status_code == 200, res.status_code
        df = pd.read_csv(StringIO(res.data.decode("utf-8")))
        assert len(df) == 1
        expected_filename = Dataset.get_dataset_by_name(
            entity_summary.dep_enum.name
        ).display_name
        assert (
            "filename={} {}.csv".format(entity_summary.label, expected_filename)
            in res.headers["Content-Disposition"]
        )
        expected_column_names = [
            "Depmap ID",
            "Cell Line Name",
            "Primary Disease",
            "Lineage",
            "Lineage Subtype",
            expected_filename,
        ]
        assert set(expected_column_names) == set(df.columns)
