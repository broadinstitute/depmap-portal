from depmap.global_search.models import *
from depmap.entity.models import EntityAlias
from depmap.gene.models import Gene
from depmap.cell_line import models as cell_line_models
from depmap.context.models import Context
from depmap.database import transaction
from depmap.settings.settings import TestConfig
from loader import global_search_loader
from tests.factories import CompoundFactory, EntityAliasFactory, GeneFactory
from tests.utilities.override_fixture import override


def test_load_gene_search_index(empty_db_mock_downloads):
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

    obj = GlobalSearchIndex.query.one()

    assert isinstance(obj, GeneSearchIndex)
    assert obj.label == "GENE1"
    assert obj.type == "gene"
    assert obj.gene_id == gene.entity_id


def test_load_gene_alias_search_index(empty_db_mock_downloads):
    """
    Test that output of format_for_dropdown is as expected 
    """
    gene_alias = EntityAlias(alias="GENEALIAS1")
    gene = Gene(
        entity_alias=[gene_alias],
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

    obj = GlobalSearchIndex.query.filter(GlobalSearchIndex.type == "gene_alias").one()

    assert isinstance(obj, GeneAliasSearchIndex)

    assert obj.label == "GENEALIAS1"
    assert obj.type == "gene_alias"
    assert obj.entity_id == gene.entity_id


def test_load_compound_search_index(empty_db_mock_downloads):
    alias = EntityAliasFactory(alias="alias1")
    target = GeneFactory(label="gene")
    compound = CompoundFactory(
        label="X",
        entity_alias=[alias],
        target_or_mechanism="Z inhibitor; Y inhibitor",
        target_gene=[target],
    )
    empty_db_mock_downloads.session.flush()

    global_search_loader.load_global_search_index()

    obj = GlobalSearchIndex.query.filter(GlobalSearchIndex.type == "compound").one()
    assert isinstance(obj, CompoundSearchIndex)
    assert obj.label == "X"
    assert obj.entity_id == compound.entity_id

    objs = (
        GlobalSearchIndex.query.filter(
            GlobalSearchIndex.type == "compound_target_or_mechanism"
        )
        .order_by(GlobalSearchIndex.label)
        .all()
    )
    assert len(objs) == 2
    obj = objs[0]
    assert isinstance(obj, CompoundTargetOrMechanismSearchIndex)
    assert obj.label == "Y inhibitor"
    assert obj.entity_id == compound.entity_id
    obj = objs[1]
    assert isinstance(obj, CompoundTargetOrMechanismSearchIndex)
    assert obj.label == "Z inhibitor"
    assert obj.entity_id == compound.entity_id

    obj = GlobalSearchIndex.query.filter(
        GlobalSearchIndex.type == "compound_alias"
    ).one()
    assert isinstance(obj, CompoundAliasSearchIndex)
    assert obj.label == "alias1"
    assert obj.entity_id == compound.entity_id

    obj = GlobalSearchIndex.query.filter(
        GlobalSearchIndex.type == "compound_target"
    ).one()
    assert isinstance(obj, CompoundTargetSearchIndex)
    assert obj.label == "gene"
    assert obj.entity_id == compound.entity_id


def test_load_compound_with_no_moa(empty_db_mock_downloads):
    compound = CompoundFactory(label="X", entity_alias=[])
    empty_db_mock_downloads.session.flush()

    global_search_loader.load_global_search_index()

    obj = GlobalSearchIndex.query.filter(GlobalSearchIndex.type == "compound").one()
    assert isinstance(obj, CompoundSearchIndex)
    assert obj.label == "X"
    assert obj.entity_id == compound.entity_id

    assert (
        GlobalSearchIndex.query.filter(
            GlobalSearchIndex.type == "compound_target_or_mechanism"
        ).one_or_none()
        is None
    )
    assert (
        GlobalSearchIndex.query.filter(
            GlobalSearchIndex.type == "compound_alias"
        ).one_or_none()
        is None
    )


def test_load_cell_line_search_index(empty_db_mock_downloads):
    """
    Test that output of format_for_dropdown is as expected
    Just using interactive_db_mock_downloads, CellLine object is annoying to mock up since you need to import and create all the sub-objects
    """
    primary_disease = cell_line_models.PrimaryDisease(name="a")
    cell_line_obj = cell_line_models.CellLine(
        cell_line_name="cell_line_1",
        depmap_id="ACH-1",
        cell_line_display_name="1",
        primary_disease=primary_disease,
        disease_subtype=cell_line_models.DiseaseSubtype(
            name="a", primary_disease=primary_disease
        ),
        tumor_type=cell_line_models.TumorType(name="a"),
        culture_medium=cell_line_models.CultureMedium(name="a"),
        conditions=cell_line_models.Conditions(name="a"),
        context=[Context(name="a")],
    )
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(cell_line_obj)

    global_search_loader.load_global_search_index()

    obj = GlobalSearchIndex.query.filter(GlobalSearchIndex.type == "cell_line").one()

    assert isinstance(obj, CellLineSearchIndex)
    assert obj.label == "1"
    assert obj.type == "cell_line"
    assert obj.cell_line.cell_line_name == "cell_line_1"
    assert obj.depmap_id == "ACH-1"

    obj = GlobalSearchIndex.query.filter(
        GlobalSearchIndex.type == "cell_line_alias"
    ).one()
    assert isinstance(obj, CellLineAliasSearchIndex)
    assert obj.label == "ACH-1"
    assert obj.type == "cell_line_alias"
    assert obj.cell_line.cell_line_name == "cell_line_1"
    assert obj.depmap_id == "ACH-1"


def config(request):
    """
    Override the default conftest config fixture
    """

    class TestVersionConfig(TestConfig):
        ENV_TYPE = "public"

    return TestVersionConfig


@override(config=config)
def test_load_context_search_index_context_explorer_disabled(
    app, empty_db_mock_downloads
):
    """
    Test that output of format_for_dropdown is as expected
    Just using interactive_db_mock_downloads, CellLine object is annoying to mock up since you need to import and create all the sub-objects
    """

    assert not app.config["ENABLED_FEATURES"].context_explorer

    context = Context(name="context_1")
    with transaction(empty_db_mock_downloads):
        empty_db_mock_downloads.session.add(context)

    global_search_loader.__load_context_search_index()

    obj = GlobalSearchIndex.query.one()
    assert isinstance(obj, ContextSearchIndex)
    assert obj.label == "Context 1"
    assert obj.type == "context"
    assert obj.context_name == "context_1"


def test_load_context_search_index_context_explorer_enabled(app, populated_db):
    """
    Test that output of format_for_dropdown is as expected
    Just using interactive_db_mock_downloads, CellLine object is annoying to mock up since you need to import and create all the sub-objects
    """

    assert app.config["ENABLED_FEATURES"].context_explorer
    with populated_db.app.test_client():
        global_search_loader.__load_context_search_index()

    obj = GlobalSearchIndex.query.all()
    assert isinstance(obj[0], ContextExplorerSearchIndex)
    assert obj[0].label == "Melanoma in Skin"
    assert obj[0].type == "context_explorer"
