from depmap.cell_line.models import CellLine
from depmap.partials.data_table.models import DataTable
from depmap.partials.data_table.factories import get_data_table
from depmap.utilities.registration import _factories
from depmap.gene.models import Gene
from depmap.cell_line.models_new import DepmapModel
from json import loads as json_loads

"""
Test views and factories together, since testing views repeats everything done when testing factories
"""


def test_data_table_factories_json_data(populated_db):
    """
    Test
    Each factory returns a DataTable object
    The ajax_url generated from the DataTable object is valid and works
    Test for every data_table, so we test that all the queries are at least valid

    The loop is done within the test instead of pytest parameterize so that we only load populated_db once. Everything is read-only so there shouldn't be an issue
    
    This tests that all our data tables are working in that they at least throw no errors, helping to catch e.g. if we accidentally missed a parameter on a table
    """
    gene = Gene.query.first()
    gene_id = gene.entity_id
    model_id = DepmapModel.query.first().model_id

    type_and_params = [
        ("mutation_by_gene", {"gene_id": gene_id}),
        ("translocation_by_gene", {"gene_id": gene_id}),
        ("fusion_by_gene", {"gene_id": gene_id}),
        ("mutation_by_cell_line", {"model_id": model_id}),
        ("translocation_by_cell_line", {"model_id": model_id}),
        ("fusion_by_cell_line", {"model_id": model_id}),
        ("context_cell_lines", {"context": "melanoma"}),
        ("context_dependency_enrichment", {"context": "melanoma"}),
        ("cell_line_selector_lines", {}),
    ]

    # Check that we test every registered factory
    expected_types = {
        second_key
        for first_key, second_key in _factories.keys()
        if first_key == "data_table"
    }
    assert {type for type, params in type_and_params} == expected_types

    with populated_db.app.test_client() as c:
        for type, params in type_and_params:
            table = get_data_table(type, **params)
            assert isinstance(table, DataTable)

            ajax_url = table.data_for_ajax_partial()["ajax_url"]

            r = c.get(ajax_url)
            assert r.status_code == 200, r.status_code
            response = json_loads(r.data.decode("utf8"))
            assert set(response.keys()) == {"data", "cols"}
