from depmap.global_search.models import ContextExplorerSearchIndex, GlobalSearchIndex
from depmap.gene.models import Gene
from depmap.entity.models import EntityAlias
from depmap.cell_line import models as cell_line_models
from depmap.database import transaction
from depmap.settings.settings import TestConfig
from loader import global_search_loader
from tests.utilities.override_fixture import override


def test_gene_search_index(empty_db_mock_downloads):
    """
    Test that output of format_for_dropdown is as expected 
    """
    gene = Gene(
        entity_alias=[],
        label="GENE1",
        name="Gene 1",
        description="",
        entrez_id=0,
        ensembl_id="ENSG0",
        hgnc_id="HGNC:0",
        locus_type="fake locus",
    )
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(gene)

    global_search_loader.__load_gene_search_index()

    expected = {
        "label": "GENE1",
        "description": "Gene 1",
        "type": "gene",
        "value": "gene:GENE1:Gene 1",
        "url": "/gene/GENE1",
    }
    assert (
        GlobalSearchIndex.query.filter_by(label="GENE1").one().format_for_dropdown()
        == expected
    )


def test_gene_alias_search_index(empty_db_mock_downloads):
    """
    Test that output of format_for_dropdown is as expected 
    """
    gene = Gene(
        entity_alias=[EntityAlias(alias="GENEALIAS1")],
        label="GENE1",
        name="Gene 1",
        description="",
        entrez_id=0,
        ensembl_id="ENSG0",
        hgnc_id="HGNC:0",
        locus_type="fake locus",
    )
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(gene)

    global_search_loader.load_global_search_index()

    expected = {
        "label": "GENEALIAS1",
        "description": "(GENE1) Gene 1",
        "type": "gene_alias",
        "value": "gene_alias:GENEALIAS1:(GENE1) Gene 1",
        "url": "/gene/GENE1",
    }
    assert (
        GlobalSearchIndex.query.filter_by(label="GENEALIAS1")
        .one()
        .format_for_dropdown()
        == expected
    )


def test_cell_line_search_index(empty_db_mock_downloads):
    """
    Test that output of format_for_dropdown is as expected
    Just using interactive_db_mock_downloads, CellLine object is annoying to mock up since you need to import and create all the sub-objects
    """
    primary_disease = cell_line_models.PrimaryDisease(name="primary_disease_1")
    cell_line_obj = cell_line_models.CellLine(
        cell_line_name="cell_line_1",
        depmap_id="depmap_id_1",
        cell_line_display_name="1",
        primary_disease=primary_disease,
        disease_subtype=cell_line_models.DiseaseSubtype(
            name="a", primary_disease=primary_disease
        ),
        tumor_type=cell_line_models.TumorType(name="a"),
        culture_medium=cell_line_models.CultureMedium(name="a"),
        conditions=cell_line_models.Conditions(name="a"),
        # context=[Context(name="a")],
    )
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(cell_line_obj)

    global_search_loader.__load_cell_line_search_index()

    expected = {
        "label": "1",
        "description": "primary_disease_1",
        "type": "cell_line",
        "value": "cell_line:1:primary_disease_1",
        "url": "/cell_line/depmap_id_1",
    }
    assert (
        GlobalSearchIndex.query.filter_by(label="1").one().format_for_dropdown()
        == expected
    )


def test_context_search_index_context_explorer_enabled(populated_db):
    """
    Test that output of format_for_dropdown is as expected
    """
    with populated_db.app.test_client():
        global_search_loader.__load_context_search_index()

    obj = GlobalSearchIndex.query.all()

    assert isinstance(obj[0], ContextExplorerSearchIndex)

    expected = {
        "label": "ES",
        "description": "Find cell lines which are members of ES context",
        "type": "subtype_context",
        "value": "subtype_context:ES:Find cell lines which are members of ES context",
        "url": "/context_explorer/?context=ES",
    }
    assert (
        GlobalSearchIndex.query.filter_by(label="ES").one().format_for_dropdown()
        == expected
    )
