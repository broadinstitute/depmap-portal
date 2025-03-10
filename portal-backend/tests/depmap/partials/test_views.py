from io import StringIO

import pandas as pd
from flask import url_for

from depmap.database import db
from tests.factories import (
    DepmapModelFactory,
    MutationFactory,
    GeneFactory,
)


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
