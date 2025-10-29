import dataclasses
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeContext, SubtypeNode
from depmap.context_explorer import box_plot_utils, enrichment_tile_filters
from depmap.context_explorer.utils import get_compound_experiment
from depmap.dataset.models import DependencyDataset
from depmap.gene.models import Gene
import numpy as np
import pytest
from tests.factories import (
    CellLineFactory,
    CompoundExperimentFactory,
    ContextAnalysisFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    GeneFactory,
    MatrixFactory,
    SubtypeContextFactory,
    SubtypeNodeFactory,
)
import pandas as pd
from tests.utilities import interactive_test_utils


def make_subtype_node_objects(
    level_0_code, node_level, tree_type, total_desired_levels
):
    level_1 = None
    level_2 = None
    level_3 = None
    level_4 = None
    level_5 = None
    for level in range(total_desired_levels):
        if level == 0:
            code = level_0_code
        else:
            code = f"{level_0_code}{level}"
            if level == 1:
                level_1 = code
            if level == 2:
                level_2 = code
            if level == 3:
                level_3 = code
            if level == 4:
                level_4 = code
            if level == 5:
                level_5 = code

        test = SubtypeNodeFactory(
            node_name=f"{code}_NODE",
            subtype_code=f"{code}",
            node_level=level,
            level_0=f"{level_0_code}",
            level_1=level_1,
            level_2=level_2,
            level_3=level_3,
            level_4=level_4,
            level_5=level_5,
            tree_type=tree_type,
        )


def make_depmap_model_objects(level_0_code, node_level, number_of_models):
    # only make the new factory if we haven't already added one
    models = []
    for num in range(number_of_models):
        model = DepmapModel.get_by_model_id(
            model_id=f"{level_0_code}_model_id{num}_level{node_level}"
        )

        if model == None:
            model = DepmapModelFactory(
                model_id=f"{level_0_code}_model_id{num}_level{node_level}",
                cell_line=CellLineFactory(
                    depmap_id=f"{level_0_code}_model_id{num}_level{node_level}"
                ),
                stripped_cell_line_name=f"stripped_cell_line_name_of_{level_0_code}_model_id{num}_level{node_level}",
            )
        models.append(model)

    return models


def set_up_node_and_context_objects(
    empty_db_mock_downloads,
    dataset_name: str,
    entity_type: str,
    make_level_0_significant: bool,
    tree_type: str = "Lineage",
):
    """
    Node Levels:
    -----------
    0   1    2    3    4

    SubtypeNode Tree:
    ----
    A - A1 - A2 - A3 - A4* 
        |          
        A2A               
        |
        A3A         

    *subtype node with 0 models
    """
    level_0_code = "A"
    make_subtype_node_objects(level_0_code, 0, tree_type, 5)

    child_nodes = SubtypeNode.get_children_using_current_level_code("A", 0)

    child_node_codes = [node.subtype_code for node in child_nodes]
    assert child_node_codes == ["A1", "A2", "A3", "A4"]

    models = make_depmap_model_objects(
        level_0_code=level_0_code, node_level=0, number_of_models=6,
    )
    SubtypeContextFactory(subtype_code=level_0_code, depmap_model=models)

    models = make_depmap_model_objects(
        level_0_code=level_0_code, node_level=1, number_of_models=5
    )
    SubtypeContextFactory(subtype_code="A1", depmap_model=models)

    models = make_depmap_model_objects(
        level_0_code=level_0_code, node_level=2, number_of_models=2
    )
    SubtypeContextFactory(subtype_code="A2", depmap_model=models)

    models = make_depmap_model_objects(
        level_0_code=level_0_code, node_level=3, number_of_models=2
    )
    SubtypeContextFactory(subtype_code="A3", depmap_model=models)

    # Added no models for A4 on purpose

    # Next, add the children of A1
    A2A_code = "A2A"
    A2A_model_ids = ["A_model_id1_level0", "A_model_id2_level0", "A_model_id5_level0"]
    SubtypeNodeFactory(
        node_name=f"{A2A_code}_NODE",
        subtype_code=f"{A2A_code}",
        node_level=2,
        level_0=level_0_code,
        level_1="A1",
        level_2=A2A_code,
        level_3=None,
        level_4=None,
        level_5=None,
        tree_type=tree_type,
    )
    models = [
        DepmapModel.get_by_model_id(model_id)
        for i, model_id in enumerate(A2A_model_ids)
    ]

    SubtypeContextFactory(subtype_code=A2A_code, depmap_model=models)

    A3A_code = "A3A"
    A3A_model_ids = ["A_model_id1_level0", "A_model_id5_level0"]
    SubtypeNodeFactory(
        node_name=f"{A3A_code}_NODE",
        subtype_code=f"{A3A_code}",
        node_level=3,
        level_0="A",
        level_1="A1",
        level_2=A2A_code,
        level_3=A3A_code,
        level_4=None,
        level_5=None,
        tree_type=tree_type,
    )
    models = [
        DepmapModel.get_by_model_id(model_id)
        for i, model_id in enumerate(A3A_model_ids)
    ]
    SubtypeContextFactory(subtype_code=A3A_code, depmap_model=models)

    contexts = SubtypeContext.query.all()
    matrix_models = [
        cell_line for context in contexts for cell_line in context.depmap_model
    ]

    entity = GeneFactory() if entity_type == "gene" else CompoundExperimentFactory()
    matrix = MatrixFactory(
        entities=[entity],
        data=np.array([[num for num in range(len(matrix_models))]]),
        cell_lines=matrix_models,
        using_depmap_model_table=True,
    )

    dataset = DependencyDatasetFactory(
        display_name=dataset_name,
        name=DependencyDataset.DependencyEnum(dataset_name),
        matrix=matrix,
        priority=1,
    )

    if make_level_0_significant:
        ContextAnalysisFactory(
            dataset=dataset,
            subtype_context=SubtypeContext.get_by_code(level_0_code),
            out_group="All Others",
            entity=entity,
            effect_size=-0.5,  # Make sure this results in an abs_effect_size of 0.05
            t_qval=0.01,
            frac_dep_in=0.2 if entity_type == "gene" else None,
        )
    else:
        ContextAnalysisFactory(
            dataset=dataset,
            subtype_context=SubtypeContext.get_by_code(level_0_code),
            out_group="All Others",
            entity=entity,
            effect_size=1000,
            t_qval=1000,
            frac_dep_in=0.001 if entity_type == "gene" else None,
        )

    # Make A1, A2A significant
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=SubtypeContext.get_by_code("A1"),
        out_group="All Others",
        entity=entity,
        effect_size=-0.5,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=0.01,
        frac_dep_in=0.2 if entity_type == "gene" else None,
    )

    # Not significant unless show_positive_effect_size filter turned ON
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=SubtypeContext.get_by_code("A2A"),
        out_group="All Others",
        entity=entity,
        effect_size=0.5,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=0.01,
        frac_dep_in=0.2 if entity_type == "gene" else None,
    )

    # Using effect_size, t_qval, and frac_dep_in: Make sure A2, A3, A3A are not significant
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=SubtypeContext.get_by_code("A2"),
        out_group="All Others",
        entity=entity,
        effect_size=1000,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=1000,
        frac_dep_in=0.001 if entity_type == "gene" else None,
    )
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=SubtypeContext.get_by_code("A3"),
        out_group="All Others",
        entity=entity,
        effect_size=1000,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=1000,
        frac_dep_in=0.001 if entity_type == "gene" else None,
    )
    ContextAnalysisFactory(
        dataset=dataset,
        subtype_context=SubtypeContext.get_by_code("A3A"),
        out_group="All Others",
        entity=entity,
        effect_size=1000,  # Make sure this results in an abs_effect_size of 0.05
        t_qval=1000,
        frac_dep_in=0.001 if entity_type == "gene" else None,
    )

    ### A4 has no models so it shouldn't have any ContextAnalyses

    return entity


# To match context explorer filters
def get_context_explorer_box_plot_filters(dataset_name: str):
    frac_dep_in = 0.1
    max_fdr = 0.01
    min_abs_effect_size = 0.25
    if dataset_name == DependencyDataset.DependencyEnum.Prism_oncology_AUC:
        max_fdr = 0.1
        min_abs_effect_size = 0.1
    elif dataset_name == DependencyDataset.DependencyEnum.Rep_all_single_pt:
        max_fdr = 0.1
        min_abs_effect_size = 0.5

    return max_fdr, min_abs_effect_size, frac_dep_in


@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_sig_context_dataframe_level_0_significant(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=True,
        tree_type=tree_type,
    )
    entity_id = (
        Gene.get_by_label(entity.label).entity_id
        if entity_type == "gene"
        else get_compound_experiment(entity.label).entity_id
    )
    empty_db_mock_downloads.session.flush()

    max_fdr, min_abs_effect_size, frac_dep_in = get_context_explorer_box_plot_filters(
        dataset_name=dataset_name
    )

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=entity_id,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=frac_dep_in,
    )

    assert sig_contexts.columns.values.tolist() == ["level_0", "subtype_code"]
    assert sig_contexts.values.tolist() == [["A", "A1"], ["A", "A"]]


@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_sig_context_dataframe_level_0_not_significant(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=False,
        tree_type=tree_type,
    )
    entity_id = (
        Gene.get_by_label(entity.label).entity_id
        if entity_type == "gene"
        else get_compound_experiment(entity.label).entity_id
    )
    empty_db_mock_downloads.session.flush()

    max_fdr, min_abs_effect_size, frac_dep_in = get_context_explorer_box_plot_filters(
        dataset_name=dataset_name
    )

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=entity_id,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=frac_dep_in,
    )

    assert sig_contexts.columns.values.tolist() == ["level_0", "subtype_code"]
    assert sig_contexts.values.tolist() == [["A", "A1"]]


def test_get_enrichment_tile_filters():
    (
        max_fdr,
        min_abs_effect_size,
        min_frac_dep_in,
    ) = enrichment_tile_filters.get_enrichment_tile_filters(
        entity_type="gene",
        dataset_name=DependencyDataset.DependencyEnum.Chronos_Combined.name,
    )

    assert max_fdr == 0.1
    assert min_abs_effect_size == 0.25
    assert min_frac_dep_in == 0.1

    (
        max_fdr,
        min_abs_effect_size,
        min_frac_dep_in,
    ) = enrichment_tile_filters.get_enrichment_tile_filters(
        entity_type="compound",
        dataset_name=DependencyDataset.DependencyEnum.Prism_oncology_AUC.name,
    )

    assert max_fdr == 0.1
    assert min_abs_effect_size == 0.1

    (
        max_fdr,
        min_abs_effect_size,
        min_frac_dep_in,
    ) = enrichment_tile_filters.get_enrichment_tile_filters(
        entity_type="compound",
        dataset_name=DependencyDataset.DependencyEnum.Rep_all_single_pt.name,
    )

    assert max_fdr == 0.1
    assert min_abs_effect_size == 0.5


@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_sig_context_data_frame_show_positive_effect_sizes(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=True,
        tree_type=tree_type,
    )
    entity_id = (
        Gene.get_by_label(entity.label).entity_id
        if entity_type == "gene"
        else get_compound_experiment(entity.label).entity_id
    )
    empty_db_mock_downloads.session.flush()

    max_fdr, min_abs_effect_size, frac_dep_in = get_context_explorer_box_plot_filters(
        dataset_name=dataset_name
    )

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=entity_id,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=frac_dep_in,
        show_positive_effect_sizes=True,
    )
    assert sig_contexts.columns.values.tolist() == ["level_0", "subtype_code"]
    assert sig_contexts.values.tolist() == [["A", "A2A"], ["A", "A1"], ["A", "A"]]

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=entity_id,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=frac_dep_in,
        show_positive_effect_sizes=False,
    )
    assert sig_contexts.values.tolist() == [["A", "A1"], ["A", "A"]]


@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_sig_context_dataframe_no_significant_analyses_found(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=True,
        tree_type=tree_type,
    )

    empty_db_mock_downloads.session.flush()

    max_fdr, min_abs_effect_size, frac_dep_in = get_context_explorer_box_plot_filters(
        dataset_name=dataset_name
    )

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=9999,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=1,
        min_frac_dep_in=frac_dep_in,
        show_positive_effect_sizes=True,
    )
    assert sig_contexts.empty


@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_context_plot_data(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=True,
        tree_type=tree_type,
    )
    entity_id = (
        Gene.get_by_label(entity.label).entity_id
        if entity_type == "gene"
        else get_compound_experiment(entity.label).entity_id
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    max_fdr, min_abs_effect_size, frac_dep_in = get_context_explorer_box_plot_filters(
        dataset_name=dataset_name
    )

    sig_contexts = box_plot_utils.get_sig_context_dataframe(
        tree_type=tree_type,
        feature_type=entity_type,
        feature_id=entity_id,
        dataset_given_id=dataset_name,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=frac_dep_in,
        show_positive_effect_sizes=True,
    )
    assert sig_contexts["subtype_code"].values.tolist() == ["A2A", "A1", "A"]

    context_plot_box_data = box_plot_utils.get_context_plot_box_data(
        dataset_given_id=dataset_name,
        feature_type=entity_type,
        feature_label=entity.label,
        sig_contexts=sig_contexts,
        level_0="A",
        tree_type=tree_type,
    )
    assert context_plot_box_data is not None
    context_plot_box_data_dict = dataclasses.asdict(context_plot_box_data)

    # A2A doesn't have enough models to return a plot, so we should only see A and A1 here
    assert len(context_plot_box_data_dict["significant_selection"]) == 2
    assert context_plot_box_data_dict["significant_selection"][0]["label"] == "A1"
    assert context_plot_box_data_dict["significant_selection"][0]["path"] == ["A1"]
    assert context_plot_box_data_dict["significant_selection"][0]["data"] == [
        6,
        7,
        8,
        9,
        10,
    ]

    assert context_plot_box_data_dict["significant_selection"][1]["label"] == "A"
    assert context_plot_box_data_dict["significant_selection"][1]["path"] == ["A"]
    assert context_plot_box_data_dict["significant_selection"][1]["data"] == [
        0,
        1,
        2,
        3,
        4,
        5,
        15,
        16,
        17,
        18,
        19,
    ]

    # Insignificant selection provides the data for the Other <Lineage> plots.
    # For example, if Bone is one collapsible card. Opening the card will show colored
    # significant plots as well as "Other Bone".

    # Construct an Other Lineage group that contains all models that are in the level_0
    # context but not in any significant contexts in level_1 --> level_5. This is true
    # regardless of if the level_0 context itself is significant. The purpose of this is
    # to see the distribution of all models in a lineage when the card is open, so the
    # user can understand if it is a tissue-wide dependency or a subtype-specific dependency.
    #
    # Example: Bone, Ewings, and ES:EWSR1-FLI1 might be significant for a particular gene.
    # That leaves Bone's other children as insignificant. ES and OS make up a large portion
    # of Bone's children. Plotting OS (and other insignificant Bone children) in an Other Lineage
    # plot enables the user to visualize that Bone is a dependency primarily due to Ewings (e.g.
    # this is a subtype_specific dependency).
    assert context_plot_box_data_dict["insignificant_selection"]["label"] == "Other A"
    assert len(context_plot_box_data_dict["insignificant_selection"]["data"]) > 0

    # Any model in "A" that is not in "A1" should show up in "Other A", aka "insignificant_selection"
    expected_other_lineage_plot_display_names = []
    for name in context_plot_box_data_dict["significant_selection"][1][
        "cell_line_display_names"
    ]:
        if (
            name
            not in context_plot_box_data_dict["significant_selection"][0][
                "cell_line_display_names"
            ]
        ):
            expected_other_lineage_plot_display_names.append(name)

    for cell_line_display_name in context_plot_box_data_dict["insignificant_selection"]:
        # Make sure A1 models are not in insignificant_selection
        assert (
            cell_line_display_name
            not in context_plot_box_data_dict["significant_selection"][0][
                "cell_line_display_names"
            ]
        )

    assert context_plot_box_data_dict["other_cards"] == []
    assert context_plot_box_data_dict["insignificant_heme_data"] == {
        "label": "Other Heme",
        "data": [],
        "cell_line_display_names": [],
        "path": None,
    }
    assert context_plot_box_data_dict["insignificant_solid_data"] == {
        "label": "Other Solid",
        "data": [],
        "cell_line_display_names": [],
        "path": None,
    }


######################################
### Enriched Lineage Tile Specific ###
######################################
@pytest.mark.parametrize(
    "dataset_name, entity_type, tree_type",
    [
        ("Chronos_Combined", "gene", "Lineage"),
        ("Chronos_Combined", "gene", "MolecularSubtype"),
        ("Rep_all_single_pt", "compound", "Lineage"),
        ("Rep_all_single_pt", "compound", "MolecularSubtype"),
        ("Prism_oncology_AUC", "compound", "Lineage"),
        ("Prism_oncology_AUC", "compound", "MolecularSubtype"),
    ],
)
def test_get_data_to_show_if_no_contexts_significant(
    empty_db_mock_downloads, dataset_name, entity_type, tree_type
):
    entity = set_up_node_and_context_objects(
        empty_db_mock_downloads=empty_db_mock_downloads,
        dataset_name=dataset_name,
        entity_type=entity_type,
        make_level_0_significant=False,
        tree_type=tree_type,
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Pretending sig_contexts is empty so we don't need to write a new
    # set_up_node_and_context_objects just to create no contexts significant

    data = box_plot_utils.get_data_to_show_if_no_contexts_significant(
        entity_type=entity_type,
        feature_label=entity.label,
        tree_type=tree_type,
        dataset_given_id=dataset_name,
    )

    assert len(data["box_plot_data"]["significant_selection"]) == 0
    assert data["box_plot_data"]["insignificant_selection"] == None
    assert len(data["box_plot_data"]["other_cards"]) == 0
    # We didn't set anything up as MYELOID or LYMPH, so there shouldn't be any Heme data
    assert len(data["box_plot_data"]["insignificant_heme_data"]["data"]) == 0
    assert len(data["box_plot_data"]["insignificant_solid_data"]["data"]) > 0
