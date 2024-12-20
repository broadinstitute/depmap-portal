import pandas as pd
import pytest
from depmap.context.models_new import (
    SubtypeContext,
    SubtypeContextEntity,
    SubtypeNode,
    TreeType,
)
from tests.factories import (
    DepmapModelFactory,
    SubtypeContextFactory,
    SubtypeNodeFactory,
    SubtypeContextEntityFactory,
)

####### Setup Factories ##########
def _setup_factories(
    empty_db_mock_downloads,
    bone_code,
    es_code,
    chs_code,
    ddchs_code,
    emchs_code,
    bone_child_level1_num1,
    bone_child_level1_num2,
    bone_child_level2_num1,
    bone_child_level2_num2,
):
    bone_node = SubtypeNodeFactory(
        subtype_code=bone_code,
        node_level=0,
        level_0=bone_code,
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    bone_models = [
        DepmapModelFactory(model_id="BONE_MODEL1(es)"),
        DepmapModelFactory(model_id="BONE_MODEL2(chs)"),
        DepmapModelFactory(model_id="BONE_MODEL3(chs)(ddchs)"),
        DepmapModelFactory(model_id="BONE_MODEL4(chs)(emchs)"),
        DepmapModelFactory(model_id="BONE_MODEL5(chs)(emchs)"),
    ]
    es_models = [bone_models[0]]
    chs_models = [bone_models[1], bone_models[2], bone_models[3], bone_models[4]]
    ddchs_models = [bone_models[2]]
    emchs_models = [bone_models[3], bone_models[4]]

    SubtypeContextFactory(subtype_code=bone_code, depmap_model=bone_models)

    es_node = SubtypeNodeFactory(
        subtype_code=es_code,
        node_level=1,
        level_0=bone_code,
        level_1=bone_child_level1_num1,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    SubtypeContextFactory(subtype_code=es_code, depmap_model=es_models)

    chs_node = SubtypeNodeFactory(
        subtype_code=chs_code,
        node_level=1,
        level_0=bone_code,
        level_1=bone_child_level1_num2,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    SubtypeContextFactory(subtype_code=chs_code, depmap_model=chs_models)

    ddchs_node = SubtypeNodeFactory(
        subtype_code=ddchs_code,
        node_level=2,
        level_0=bone_code,
        level_1=bone_child_level1_num2,
        level_2=bone_child_level2_num1,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    SubtypeContextFactory(subtype_code=ddchs_code, depmap_model=ddchs_models)

    emchs_node = SubtypeNodeFactory(
        subtype_code=emchs_code,
        node_level=2,
        level_0=bone_code,
        level_1=bone_child_level1_num2,
        level_2=bone_child_level2_num2,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    SubtypeContextFactory(subtype_code=emchs_code, depmap_model=emchs_models)

    empty_db_mock_downloads.session.flush()
    return bone_models, es_models, chs_models, ddchs_models, emchs_models


def test_get_all_names(empty_db_mock_downloads):
    context_1 = SubtypeContextFactory()
    context_2 = SubtypeContextFactory()
    empty_db_mock_downloads.session.flush()

    assert set(SubtypeContext.get_all_codes()) == {
        context_1.subtype_code,
        context_2.subtype_code,
    }


def test_subtype_context_get_by_subtype_code(empty_db_mock_downloads):
    depmap_model = DepmapModelFactory()
    context = SubtypeContextFactory(depmap_model=[depmap_model])
    empty_db_mock_downloads.session.flush()

    assert SubtypeContext.get_by_code(context.subtype_code) == context


def test_subtype_context_entity_get_by_label(empty_db_mock_downloads):
    context_entity = SubtypeContextEntityFactory()
    empty_db_mock_downloads.session.flush()

    assert SubtypeContextEntity.get_by_label(context_entity.label) == context_entity


def test_get_cell_line_table_query(empty_db_mock_downloads):
    model = DepmapModelFactory(primary_or_metastasis=None)
    node = SubtypeNodeFactory(
        subtype_code=model.depmap_model_type, level_1=model.oncotree_primary_disease
    )
    context = SubtypeContextFactory(
        subtype_code=model.depmap_model_type, depmap_model=[model]
    )
    empty_db_mock_downloads.session.flush()
    query = SubtypeContext.get_cell_line_table_query(context.subtype_code)

    df = pd.read_sql(query.statement, query.session.connection())

    assert len(df) == 1
    assert df["cell_line_display_name"][0] == model.stripped_cell_line_name
    assert df["primary_disease"][0] == model.oncotree_primary_disease
    assert df["tumor_type"][0] == None


def test_get_model_ids_for_subtype_context(empty_db_mock_downloads):
    bone_code = "BONE"
    es_code = "ES"
    chs_code = "CHS"
    ddchs_code = "DDCHS"
    emchs_code = "EMCHS"
    bone_child_level1_num1 = es_code
    bone_child_level1_num2 = chs_code
    bone_child_level2_num1 = ddchs_code
    bone_child_level2_num2 = emchs_code

    def _test_get_model_ids(current_context_code, expected_models):
        expected_model_ids = [model.model_id for model in expected_models]
        current_context = SubtypeContext.get_by_code(current_context_code)
        context_model_ids = SubtypeContext.get_model_ids(current_context)
        assert context_model_ids == expected_model_ids

    bone_models, es_models, chs_models, ddchs_models, emchs_models = _setup_factories(
        empty_db_mock_downloads=empty_db_mock_downloads,
        bone_code=bone_code,
        es_code=es_code,
        chs_code=chs_code,
        ddchs_code=ddchs_code,
        emchs_code=emchs_code,
        bone_child_level1_num1=bone_child_level1_num1,
        bone_child_level1_num2=bone_child_level1_num2,
        bone_child_level2_num1=bone_child_level2_num1,
        bone_child_level2_num2=bone_child_level2_num2,
    )

    _test_get_model_ids(bone_code, bone_models)
    _test_get_model_ids(es_code, es_models)
    _test_get_model_ids(chs_code, chs_models)
    _test_get_model_ids(ddchs_code, ddchs_models)
    _test_get_model_ids(emchs_code, emchs_models)

    with pytest.raises(Exception):
        _test_get_model_ids("NONSENSE_CODE", [])


############ SubtypeNode Tests ##############


def test_get_subtype_node_by_code(empty_db_mock_downloads):
    expected_code = "ES"
    node = SubtypeNodeFactory(subtype_code=expected_code)
    empty_db_mock_downloads.session.flush()

    assert SubtypeNode.get_by_code(node.subtype_code).subtype_code == expected_code


def test_get_subtype_tree_query(empty_db_mock_downloads):
    bone_code = "BONE"
    es_code = "ES"
    chs_code = "CHS"
    ddchs_code = "DDCHS"
    emchs_code = "EMCHS"
    bone_child_level1_num1 = es_code
    bone_child_level1_num2 = chs_code
    bone_child_level2_num1 = ddchs_code
    bone_child_level2_num2 = emchs_code

    _setup_factories(
        empty_db_mock_downloads=empty_db_mock_downloads,
        bone_code=bone_code,
        es_code=es_code,
        chs_code=chs_code,
        ddchs_code=ddchs_code,
        emchs_code=emchs_code,
        bone_child_level1_num1=bone_child_level1_num1,
        bone_child_level1_num2=bone_child_level1_num2,
        bone_child_level2_num1=bone_child_level2_num1,
        bone_child_level2_num2=bone_child_level2_num2,
    )
    query = SubtypeNode.get_subtype_tree_by_models_query(
        tree_type=TreeType.Lineage, level_0_subtype_code=bone_code
    )
    df = pd.read_sql(query.statement, query.session.connection())
    tree_nodes = df.to_dict("records")

    assert len(tree_nodes) == 65
    assert {
        "model_id": "BONE_MODEL3(chs)(ddchs)",
        "subtype_code": "BONE",
        "level_0": "BONE",
        "level_1": None,
        "level_2": None,
        "level_3": None,
        "level_4": None,
        "level_5": None,
        "node_name": "node_name_7",
        "node_level": 0,
    } in tree_nodes
    assert {
        "model_id": "BONE_MODEL2(chs)",
        "subtype_code": "ES",
        "level_0": "BONE",
        "level_1": "ES",
        "level_2": None,
        "level_3": None,
        "level_4": None,
        "level_5": None,
        "node_name": "node_name_8",
        "node_level": 1,
    } in tree_nodes

    assert {
        "model_id": "BONE_MODEL3(chs)(ddchs)",
        "subtype_code": "EMCHS",
        "level_0": "BONE",
        "level_1": "CHS",
        "level_2": "EMCHS",
        "level_3": None,
        "level_4": None,
        "level_5": None,
        "node_name": "node_name_11",
        "node_level": 2,
    } in tree_nodes

    for node in tree_nodes:
        node_level = int(node["node_level"])
        node_level_col = f"level_{node_level}"
        assert node["subtype_code"] == node[node_level_col]

        if node_level == 1 and node["level_0"] == "BONE":
            assert node["level_1"] in ["ES", "CHS"]

        if node_level == 2 and node["level_1"] == "CHS":
            assert node["level_0"] == "BONE"
            assert node["level_2"] in ["DDCHS", "EMCHS"]
            assert node["level_3"] == None
            assert node["level_4"] == None
            assert node["level_5"] == None

        if node_level == 2 and node["level_1"] == "ES":
            assert node["level_0"] == "BONE"
            assert node["level_2"] == None


def test_get_subtype_tree_query_molecular_subtypes(empty_db_mock_downloads):
    parent_code = "EGFR"
    child_code = "EGFRp.L858R"
    parent_node = SubtypeNodeFactory(
        subtype_code=parent_code,
        tree_type=TreeType.MolecularSubtype,
        node_level=0,
        level_0=parent_code,
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    child_node = SubtypeNodeFactory(
        subtype_code=child_code,
        tree_type=TreeType.MolecularSubtype,
        node_level=1,
        level_0=parent_code,
        level_1=child_code,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    parent_models = [
        DepmapModelFactory(model_id="a"),
        DepmapModelFactory(model_id="b"),
    ]

    child_models = [parent_models[0]]
    parent_context = SubtypeContextFactory(
        subtype_code=parent_code, depmap_model=parent_models
    )
    child_context = SubtypeContextFactory(
        subtype_code=child_code, depmap_model=child_models
    )
    empty_db_mock_downloads.session.flush()

    query = SubtypeNode.get_subtype_tree_by_models_query(
        tree_type=TreeType.MolecularSubtype, level_0_subtype_code=parent_code
    )
    df = pd.read_sql(query.statement, query.session.connection())
    tree_nodes = df.to_dict("records")
    assert len(tree_nodes) == 3

    assert tree_nodes == [
        {
            "model_id": "a",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": None,
            "level_2": None,
            "level_3": None,
            "level_4": None,
            "level_5": None,
            "node_name": "node_name_0",
            "node_level": 0,
        },
        {
            "model_id": "b",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": None,
            "level_2": None,
            "level_3": None,
            "level_4": None,
            "level_5": None,
            "node_name": "node_name_0",
            "node_level": 0,
        },
        {
            "model_id": "a",
            "subtype_code": "EGFRp.L858R",
            "level_0": "EGFR",
            "level_1": "EGFRp.L858R",
            "level_2": None,
            "level_3": None,
            "level_4": None,
            "level_5": None,
            "node_name": "node_name_1",
            "node_level": 1,
        },
    ]


# Make sure molecular subtype tree codes and lineage codes
# don't get mixed into these results. All unique level0s should
# be from a single tree type.
def test_get_unique_level_0s(empty_db_mock_downloads):
    # Create Lineage Nodes
    lineage_node_1 = SubtypeNodeFactory(
        subtype_code="BONE",
        tree_type=TreeType.Lineage,
        node_level=0,
        level_0="BONE",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    BONE_context = SubtypeContextFactory(
        subtype_code="BONE", depmap_model=[DepmapModelFactory()],
    )

    child1_level1_of_lineage_node_1 = SubtypeNodeFactory(
        subtype_code="ES",
        tree_type=TreeType.Lineage,
        node_level=1,
        level_0="BONE",
        level_1="ES",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    ES_LEVEL1_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL1_context", depmap_model=[DepmapModelFactory()],
    )

    child1_level2_of_child1_level1 = SubtypeNodeFactory(
        subtype_code="ES_LEVEL2",
        tree_type=TreeType.Lineage,
        node_level=2,
        level_0="BONE",
        level_1="ES",
        level_2="ES_LEVEL2",
        level_3=None,
        level_4=None,
        level_5=None,
    )

    ES_LEVEL2_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL1_context", depmap_model=[DepmapModelFactory()],
    )

    child1_level3_of_child1_level1 = SubtypeNodeFactory(
        subtype_code="ES_LEVEL3",
        tree_type=TreeType.Lineage,
        node_level=3,
        level_0="BONE",
        level_1="ES",
        level_2="ES_LEVEL2",
        level_3="ES_LEVEL3",
        level_4=None,
        level_5=None,
    )

    ES_LEVEL3_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL3_context", depmap_model=[DepmapModelFactory()],
    )

    child1_level4_of_child1_level1 = SubtypeNodeFactory(
        subtype_code="ES_LEVEL4",
        tree_type=TreeType.Lineage,
        node_level=4,
        level_0="BONE",
        level_1="ES",
        level_2="ES_LEVEL2",
        level_3="ES_LEVEL3",
        level_4="ES_LEVEL4",
        level_5=None,
    )

    ES_LEVEL4_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL4", depmap_model=[DepmapModelFactory()],
    )

    child1_level5_of_child1_level1 = SubtypeNodeFactory(
        subtype_code="ES_LEVEL5",
        tree_type=TreeType.Lineage,
        node_level=5,
        level_0="BONE",
        level_1="ES",
        level_2="ES_LEVEL2",
        level_3="ES_LEVEL3",
        level_4="ES_LEVEL4",
        level_5="ES_LEVEL5",
    )

    ES_LEVEL5_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL5", depmap_model=[DepmapModelFactory()],
    )

    child2_level1_of_lineage_node_1 = SubtypeNodeFactory(
        subtype_code="OST",
        tree_type=TreeType.Lineage,
        node_level=1,
        level_0="BONE",
        level_1="OST",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    OST_context = SubtypeContextFactory(
        subtype_code="OST", depmap_model=[DepmapModelFactory()],
    )

    lineage_node_2 = SubtypeNodeFactory(
        subtype_code="LUNG",
        tree_type=TreeType.Lineage,
        node_level=0,
        level_0="LUNG",
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    LUNG_context = SubtypeContextFactory(
        subtype_code="LUNG", depmap_model=[DepmapModelFactory()],
    )

    lineage_node_2_level_1 = SubtypeNodeFactory(
        subtype_code="LUNG_LEVEl1",
        tree_type=TreeType.Lineage,
        node_level=0,
        level_0="LUNG",
        level_1="LUNG_LEVEl1",
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )

    selected_context = SubtypeContextFactory(
        subtype_code="ES_LEVEL4",
        depmap_model=[DepmapModelFactory(), DepmapModelFactory(), DepmapModelFactory()],
    )

    # Create Molecular Subtype Nodes
    parent_code = "EGFR"
    child_code = "EGFRp.L858R"
    parent_node = SubtypeNodeFactory(
        subtype_code=parent_code,
        tree_type=TreeType.MolecularSubtype,
        node_level=0,
        level_0=parent_code,
        level_1=None,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    child_node = SubtypeNodeFactory(
        subtype_code=child_code,
        tree_type=TreeType.MolecularSubtype,
        node_level=1,
        level_0=parent_code,
        level_1=child_code,
        level_2=None,
        level_3=None,
        level_4=None,
        level_5=None,
    )
    parent_models = [
        DepmapModelFactory(model_id="a"),
        DepmapModelFactory(model_id="b"),
    ]

    child_models = [parent_models[0]]
    parent_context = SubtypeContextFactory(
        subtype_code=parent_code, depmap_model=parent_models
    )
    child_context = SubtypeContextFactory(
        subtype_code=child_code, depmap_model=child_models
    )
    empty_db_mock_downloads.session.flush()
    expected_unique_level_0s = ["BONE", "LUNG"]

    unique_level_0s = SubtypeContext.get_unique_level_0s(
        ["ES_LEVEL2", "ES_LEVEL3", "ES_LEVEL4", "OST", "LUNG_LEVEl1"]
    )

    assert unique_level_0s == expected_unique_level_0s


# TODO: Make sure no molecular subtype codes could end up in the lineage tree and vice versa
