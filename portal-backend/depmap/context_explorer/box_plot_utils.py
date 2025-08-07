from functools import partial
from operator import contains
import re
from typing import Dict, List, Literal, Optional, Set
from depmap import data_access
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound
from depmap.context_explorer.models import (
    BoxCardData,
    ContextAnalysis,
    EnrichedLineagesTileData,
    GroupedOtherBoxPlotData,
)
import dataclasses
from depmap.dataset.models import DependencyDataset
from depmap.gene.models import Gene
from depmap.tile.views import get_dependency_dataset_for_entity
import pandas as pd
from flask import url_for

from depmap.context_explorer import enrichment_tile_filters, utils
from depmap.context.models_new import SubtypeNode, SubtypeContext
from depmap.context_explorer.models import ContextPlotBoxData, BoxData, NodeEntityData


def _get_node_entity_data(
    dataset_name: str, entity_type: str, entity_full_label: str
) -> NodeEntityData:
    entity_id_and_label = utils.get_entity_id_from_entity_full_label(
        entity_type=entity_type, entity_full_label=entity_full_label
    )
    entity_id = entity_id_and_label["entity_id"]
    entity_label = entity_id_and_label["label"]
    entity_overview_page_label = entity_id_and_label["entity_overview_page_label"]

    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)

    return NodeEntityData(
        entity_id=entity_id,
        entity_label=entity_label,
        entity_full_row_of_values=entity_full_row_of_values,
        entity_overview_page_label=entity_overview_page_label,
    )


def _get_box_data(
    entity_full_row_of_values,
    model_id_display_names: Dict[str, str],
    category: Literal["heme", "solid"],
) -> BoxData:
    if model_id_display_names == {}:
        return BoxData(
            label="Other Heme" if category == "heme" else "Other Solid",
            data=[],
            cell_line_display_names=[],
        )

    model_ids = list(model_id_display_names.keys())
    values = entity_full_row_of_values[entity_full_row_of_values.index.isin(model_ids)]

    values.dropna(inplace=True)

    display_names_series = DepmapModel.get_cell_line_display_names(model_ids=model_ids)
    display_names_dict = display_names_series.to_dict()

    context_values_index_by_display_name = values.rename(index=display_names_dict)

    return BoxData(
        label="Other Heme" if category == "heme" else "Other Solid",
        data=context_values_index_by_display_name.tolist(),
        cell_line_display_names=context_values_index_by_display_name.index.tolist(),
    )


def get_box_plot_card_data(
    level_0_code: str,
    ordered_sig_subtype_codes: List[str],
    model_ids_by_code: Dict[
        str, List[str]
    ],  # Includes insignificant codes we need for "Other <Lineage>"
    entity_full_row_of_values: pd.Series,
) -> BoxCardData:
    significant_box_plot_data = []
    insignificant_box_plot_data = {}
    all_sig_models = []
    other_lineage_plot_model_ids = []

    child_codes = model_ids_by_code.keys()
    sig_child_codes = [
        code for code in child_codes if code in ordered_sig_subtype_codes
    ]

    # Sort significant codes to the front
    s = set(sig_child_codes)
    sorted_child_codes = list(filter(partial(contains, s), child_codes))
    sorted_child_codes.extend(v for v in child_codes if v not in s)

    for child in sorted_child_codes:
        context_model_ids = model_ids_by_code[child]
        if child in ordered_sig_subtype_codes:
            if len(context_model_ids) >= 5:
                box_plot = get_box_plot_data_for_context(
                    subtype_code=child,
                    entity_full_row_of_values=entity_full_row_of_values,
                    model_ids=context_model_ids,
                )
                significant_box_plot_data.append(box_plot)
                if child != level_0_code:
                    all_sig_models.extend(context_model_ids)

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
    if len(sig_child_codes) > 1 or (
        len(sig_child_codes) == 1 and level_0_code != sig_child_codes[0]
    ):
        if len(all_sig_models) >= 5:
            if level_0_code not in ordered_sig_subtype_codes:
                plot_data = get_box_plot_data_for_context(
                    subtype_code=level_0_code,
                    entity_full_row_of_values=entity_full_row_of_values,
                    model_ids=all_sig_models,
                )
                significant_box_plot_data.append(plot_data)

        # The following is not under len(all_sig_models) >= 5, because sometimes level_0 and NONE of its
        # children are significant, but we still want an Other <level_0> plot.
        level_0_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
            level_0_code, 0
        )
        level_0_model_ids.extend(other_lineage_plot_model_ids)

        all_other_model_ids = list(set(level_0_model_ids) - set(all_sig_models))

        insignificant_box_plot_data = (
            BoxData(label=f"Other {level_0_code}", data=[], cell_line_display_names=[])
            if len(all_other_model_ids) < 5
            else get_box_plot_data_for_context(
                label=f"Other {level_0_code}",
                subtype_code=level_0_code,
                entity_full_row_of_values=entity_full_row_of_values,
                model_ids=all_other_model_ids,
            )
        )
    else:
        insignificant_box_plot_data = (
            BoxData(label=f"Other {level_0_code}", data=[], cell_line_display_names=[])
            if len(other_lineage_plot_model_ids) < 5
            else get_box_plot_data_for_context(
                label=f"Other {level_0_code}",
                subtype_code=level_0_code,
                entity_full_row_of_values=entity_full_row_of_values,
                model_ids=other_lineage_plot_model_ids,
            )
        )

    def get_code_or_child(code):
        if code in ordered_sig_subtype_codes:
            return code

        node = SubtypeNode.get_by_code(code)
        assert node is not None
        node_children = SubtypeNode.get_children_using_current_level_code(
            code, node.node_level
        )

        child_codes = [node.subtype_code for node in node_children]
        for subtype_code in child_codes:
            if subtype_code in ordered_sig_subtype_codes:
                return subtype_code

        return code

    sorted_sig_plot_data = sorted(
        significant_box_plot_data,
        key=lambda x: ordered_sig_subtype_codes.index(get_code_or_child(x.path[-1])),
    )
    return BoxCardData(
        significant=sorted_sig_plot_data,
        insignificant=insignificant_box_plot_data,
        level_0_code=level_0_code,
    )


def get_box_plot_data_for_other_category(
    all_sig_context_codes: Set[str],
    entity_full_row_of_values,
    tree_type: str,
    all_sig_models: Set[str],
) -> GroupedOtherBoxPlotData:
    heme_solid_model_ids = SubtypeContext.get_model_ids_for_other_heme_and_other_solid_contexts(
        subtype_codes_to_filter_out=all_sig_context_codes,
        tree_type=tree_type,
        all_sig_models=all_sig_models,
    )

    heme_model_ids = heme_solid_model_ids.heme
    solid_model_ids = heme_solid_model_ids.solid
    heme_box_data = _get_box_data(
        entity_full_row_of_values=entity_full_row_of_values,
        model_id_display_names=heme_model_ids,
        category="heme",
    )
    solid_box_data = _get_box_data(
        entity_full_row_of_values=entity_full_row_of_values,
        model_id_display_names=solid_model_ids,
        category="solid",
    )

    return GroupedOtherBoxPlotData(heme=heme_box_data, solid=solid_box_data)


def get_box_plot_data_for_context(
    subtype_code: str,
    entity_full_row_of_values,
    model_ids: List[str],
    label: Optional[str] = None,
) -> BoxData:
    context_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(model_ids)
    ]
    context_values.dropna(inplace=True)

    display_names_series = DepmapModel.get_cell_line_display_names(
        model_ids=list(set(model_ids))
    )
    display_names_dict = display_names_series.to_dict()

    context_values_index_by_display_name = context_values.rename(
        index=display_names_dict
    )

    node = SubtypeNode.get_by_code(subtype_code)

    assert node is not None
    path = utils.get_path_to_node(node.subtype_code).path
    path = path[1:] if len(path) > 1 else path
    delim = "/"

    plotLabel = delim.join(path) if not label else label

    return BoxData(
        label=plotLabel,
        path=path,
        data=context_values_index_by_display_name.tolist(),
        cell_line_display_names=context_values_index_by_display_name.index.tolist(),
    )


def get_branch_subtype_codes_organized_by_code(sig_contexts: Dict[str, List[str]]):
    branch_contexts = {}
    all_sig_models = []
    for level_0 in sig_contexts.keys():
        child_nodes = SubtypeNode.get_children_using_current_level_code(level_0, 0)
        child_codes = [node.subtype_code for node in child_nodes]
        branch, all_model_ids = SubtypeContext.get_model_ids_for_node_branch(
            subtype_codes=child_codes, level_0_subtype_code=level_0
        )
        if all_model_ids:
            all_sig_models.extend(all_model_ids)

        branch_contexts[level_0] = branch

    return branch_contexts, all_sig_models


def get_sig_context_dataframe(
    tree_type: str,
    entity_type: str,
    entity_id: int,
    dataset_name: str,
    max_fdr: float = 0.1,
    min_abs_effect_size: float = 0.25,
    min_frac_dep_in: float = 0.1,
    use_enrichment_tile_filters=False,
    show_positive_effect_sizes=False,
) -> pd.DataFrame:

    if use_enrichment_tile_filters:
        (
            max_fdr,
            min_abs_effect_size,
            min_frac_dep_in,
        ) = enrichment_tile_filters.get_enrichment_tile_filters(
            entity_type=entity_type, dataset_name=dataset_name
        )

    # If this doesn't find the node, something is wrong with how we
    # loaded the SubtypeNode database table data.
    sig_contexts = ContextAnalysis.get_context_dependencies(
        tree_type=tree_type,
        entity_id=entity_id,
        dataset_name=dataset_name,
        entity_type=entity_type,
        max_fdr=max_fdr,
        min_abs_effect_size=min_abs_effect_size,
        min_frac_dep_in=min_frac_dep_in,
        show_positive_effect_sizes=show_positive_effect_sizes,
    )

    return sig_contexts


def get_card_data(
    level_0: str,
    branch_contexts: dict,
    ordered_sig_subtype_codes: List[str],
    entity_full_row_of_values: pd.Series,
):
    # These are all the level_0 codes that need a box plot "card," but these
    # codes aren't necessarily all significant. If a code appears in this list,
    # either the code and/or 1 or more of it's children are significant.
    if branch_contexts != None:
        if level_0 in branch_contexts:
            selected_context_level_0 = branch_contexts[level_0]
        else:
            # This is to cover an edge case. Theoretically, it's possible for
            # nothing under the selected level_0, including the level_0, to be
            # significant. In that case, we still need to get the child nodes of
            # the level_0 so that they can be sorted into an Other <level_0> plot.
            child_nodes = SubtypeNode.get_children_using_current_level_code(level_0, 0)
            child_codes = [node.subtype_code for node in child_nodes]
            selected_context_level_0, _ = SubtypeContext.get_model_ids_for_node_branch(
                subtype_codes=child_codes, level_0_subtype_code=level_0
            )

        if selected_context_level_0 != None:
            box_plot_card_data = get_box_plot_card_data(
                level_0_code=level_0,
                model_ids_by_code=selected_context_level_0,
                entity_full_row_of_values=entity_full_row_of_values,
                ordered_sig_subtype_codes=ordered_sig_subtype_codes,
            )

            return box_plot_card_data


def get_significant_context_codes_indexed_by_level_0(sig_contexts: pd.DataFrame):
    sig_contexts_agg_indexed = sig_contexts.groupby("level_0").agg(
        {"subtype_code": list}
    )
    assert isinstance(sig_contexts_agg_indexed, pd.DataFrame)
    sig_contexts_agg = sig_contexts_agg_indexed.reset_index()

    sig_contexts_by_level_0 = sig_contexts_agg.set_index("level_0").to_dict()[
        "subtype_code"
    ]

    return sig_contexts_by_level_0


def get_all_significant_context_codes_ordered_by_significance(
    sig_contexts: pd.DataFrame,
):
    ordered_sig_subtype_codes = (
        sig_contexts["subtype_code"].drop_duplicates(keep="first").tolist()
    )
    return ordered_sig_subtype_codes


def get_context_plot_box_data(
    dataset_name: str,
    entity_type: str,
    entity_label: str,
    sig_contexts: pd.DataFrame,
    level_0: str,
    tree_type: str,
) -> Optional[ContextPlotBoxData]:
    node_entity_data = _get_node_entity_data(
        dataset_name=dataset_name,
        entity_type=entity_type,
        entity_full_label=entity_label,
    )

    entity_full_row_of_values = node_entity_data.entity_full_row_of_values

    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=node_entity_data.entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)

    drug_dotted_line = (
        entity_full_row_of_values.mean() if entity_type == "compound" else None
    )

    heme_box_plot_data = {}
    solid_box_plot_data = {}
    other_box_plot_data = []
    ordered_sig_context_codes = (
        []
        if len(sig_contexts) == 0
        else get_all_significant_context_codes_ordered_by_significance(
            sig_contexts=sig_contexts
        )
    )
    all_sig_models = []
    selected_sig_box_plot_card_data = None
    if len(sig_contexts) > 0:
        sig_contexts_by_level_0 = get_significant_context_codes_indexed_by_level_0(
            sig_contexts=sig_contexts
        )

        (
            branch_contexts,
            all_significant_models,
        ) = get_branch_subtype_codes_organized_by_code(
            sig_contexts=sig_contexts_by_level_0
        )
        all_sig_models = all_significant_models

        selected_sig_box_plot_card_data = get_card_data(
            level_0=level_0,
            branch_contexts=branch_contexts,
            entity_full_row_of_values=entity_full_row_of_values,
            ordered_sig_subtype_codes=ordered_sig_context_codes,
        )

        all_level_0_codes = branch_contexts.keys()
        for other_level_0 in all_level_0_codes:
            if level_0 != other_level_0:
                other_sig_data = get_card_data(
                    level_0=other_level_0,
                    branch_contexts=branch_contexts,
                    entity_full_row_of_values=entity_full_row_of_values,
                    ordered_sig_subtype_codes=ordered_sig_context_codes,
                )
                if other_sig_data is not None:
                    other_box_plot_data.append(other_sig_data)

    solid_and_heme_box_data = get_box_plot_data_for_other_category(
        all_sig_context_codes=set(ordered_sig_context_codes),
        entity_full_row_of_values=entity_full_row_of_values,
        tree_type=tree_type,
        all_sig_models=set(all_sig_models),
    )

    significant_selection = (
        None
        if not selected_sig_box_plot_card_data
        else selected_sig_box_plot_card_data.significant
    )
    insignificant_selection = (
        None
        if not selected_sig_box_plot_card_data
        else selected_sig_box_plot_card_data.insignificant
    )

    dataset_units = data_access.get_dataset_units(dataset_id=dataset_name)
    assert dataset_units is not None

    return ContextPlotBoxData(
        significant_selection=significant_selection,
        insignificant_selection=insignificant_selection,
        other_cards=other_box_plot_data,
        insignificant_heme_data=solid_and_heme_box_data.heme,
        insignificant_solid_data=solid_and_heme_box_data.solid,
        drug_dotted_line=drug_dotted_line,
        entity_label=node_entity_data.entity_label,
        entity_overview_page_label=node_entity_data.entity_overview_page_label,
        dataset_units=dataset_units,
    )


def get_organized_contexts(
    selected_subtype_code: str,
    sig_contexts: pd.DataFrame,
    entity_type: str,
    entity_label: str,
    dataset_name: str,
    tree_type: str,
) -> Optional[ContextPlotBoxData]:
    node = SubtypeNode.get_by_code(selected_subtype_code)
    assert node is not None

    context_box_plot_data = get_context_plot_box_data(
        dataset_name=dataset_name,
        entity_type=entity_type,
        entity_label=entity_label,
        sig_contexts=sig_contexts,
        level_0=node.level_0,
        tree_type=tree_type,
    )

    if context_box_plot_data == None:
        return None

    context_box_plot_data_other_cards = context_box_plot_data.other_cards
    sorted_other_cards = context_box_plot_data_other_cards
    if not sig_contexts.empty:
        level_0_sort_order = (
            sig_contexts["level_0"].drop_duplicates(keep="first").tolist()
        )
        sorted_other_cards = sorted(
            context_box_plot_data_other_cards,
            key=lambda x: level_0_sort_order.index(x.level_0_code),
        )

    dataset_units = data_access.get_dataset_units(dataset_id=dataset_name)
    assert dataset_units is not None

    ordered_box_plot_data = ContextPlotBoxData(
        significant_selection=context_box_plot_data.significant_selection,
        insignificant_selection=context_box_plot_data.insignificant_selection,
        other_cards=sorted_other_cards,
        insignificant_heme_data=context_box_plot_data.insignificant_heme_data,
        insignificant_solid_data=context_box_plot_data.insignificant_solid_data,
        drug_dotted_line=context_box_plot_data.drug_dotted_line,
        entity_label=context_box_plot_data.entity_label,
        entity_overview_page_label=context_box_plot_data.entity_overview_page_label,
        dataset_units=dataset_units,
    )

    return ordered_box_plot_data


################################################################################
### Enrichment Tile Boxplots (shown on the Gene and Compound overview pages) ###
################################################################################
def temp_get_compound_experiment_dataset(compound_experiment_and_datasets):
    # DEPRECATED: this method will not work with breadbox datasets. Calls to it should be replaced.
    dataset_regexp_ranking = [
        "Prism_oncology.*",
        "Rep_all_single_pt.*",
        ".*",
    ]
    ce_and_d = []
    for regexp in dataset_regexp_ranking:
        for ce, d in compound_experiment_and_datasets:
            pattern = re.compile(regexp)
            if pattern.match(d.name.value):
                ce_and_d = [[ce, d]]
                return ce_and_d


def get_compound_experiment_and_dataset_name_from_compound(compound: Compound):
    # Figure out membership in different datasets
    compound_experiment_and_datasets = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound.entity_id
    )
    compound_experiment_and_datasets = [
        x for x in compound_experiment_and_datasets if not x[1].is_dose_replicate
    ]  # filter for non dose replicate datasets"
    best_ce_and_d = temp_get_compound_experiment_dataset(
        compound_experiment_and_datasets
    )

    return best_ce_and_d


def get_gene_enriched_lineages_entity_id_and_dataset_name(
    entity_label: str,
) -> Optional[dict]:
    gene = Gene.get_by_label(entity_label)
    dataset = get_dependency_dataset_for_entity(
        DependencyDataset.DependencyEnum.Chronos_Combined.name, gene.entity_id
    )
    if dataset is None:
        return None
    dataset_name = dataset.name.name
    dataset_display_name = dataset.display_name

    return {
        "entity_id": gene.entity_id,
        "dataset_name": dataset_name,
        "dataset_display_name": dataset_display_name,
    }


def get_compound_enriched_lineages_entity_id_and_dataset_name(
    entity_label: str,
) -> dict:
    compound = Compound.get_by_label(entity_label)
    best_ce_and_d = get_compound_experiment_and_dataset_name_from_compound(compound)

    assert best_ce_and_d is not None

    compound_experiment = best_ce_and_d[0][0]
    dataset_name = best_ce_and_d[0][1].name.name
    dataset_display_name = best_ce_and_d[0][1].display_name

    return {
        "entity_id": compound_experiment.entity_id,
        "dataset_name": dataset_name,
        "compound_experiment_label": compound_experiment.label,
        "dataset_display_name": dataset_display_name,
    }


def get_data_to_show_if_no_contexts_significant(
    entity_type: str, entity_label: str, tree_type: str, dataset_name: str
):
    entity_id_and_label = utils.get_entity_id_from_entity_full_label(
        entity_type=entity_type, entity_full_label=entity_label
    )
    entity_label = entity_id_and_label["label"]
    entity_overview_page_label = entity_id_and_label["entity_overview_page_label"]

    entity_overview_page_label = entity_id_and_label["entity_overview_page_label"]
    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)
    drug_dotted_line = (
        entity_full_row_of_values.mean() if entity_type == "compound" else None
    )

    grouped_other_box_plot_data = get_box_plot_data_for_other_category(
        all_sig_context_codes=[],
        entity_full_row_of_values=entity_full_row_of_values,
        tree_type=tree_type,
        all_sig_models=[],
    )
    heme_box_plot_data = grouped_other_box_plot_data.heme

    solid_box_plot_data = grouped_other_box_plot_data.solid

    dataset_units = data_access.get_dataset_units(dataset_id=dataset_name)
    assert dataset_units is not None

    ordered_box_plot_data = ContextPlotBoxData(
        significant_selection=[],
        insignificant_selection=None,
        other_cards=[],
        insignificant_heme_data=heme_box_plot_data,
        insignificant_solid_data=solid_box_plot_data,
        drug_dotted_line=drug_dotted_line,
        entity_label=entity_label,
        entity_overview_page_label=entity_overview_page_label,
        dataset_units=dataset_units,
    )

    tile_data = EnrichedLineagesTileData(
        box_plot_data=ordered_box_plot_data,
        top_context_name_info=None,
        selected_context_name_info=None,
        dataset_name=dataset_name,
        dataset_display_name="",
        context_explorer_url=url_for("context_explorer.view_context_explorer"),
    )

    return dataclasses.asdict(tile_data)
