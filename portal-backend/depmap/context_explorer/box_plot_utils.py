from functools import partial
from operator import contains
from typing import Any, Dict, List, Literal, Optional, Set, Tuple
from depmap import data_access
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import Compound
from depmap.context_explorer.models import (
    BoxCardData,
    ContextAnalysis,
    ContextExplorerDatasets,
    EnrichedLineagesTileData,
    GroupedOtherBoxPlotData,
)
import dataclasses
from depmap.gene.models import Gene
import pandas as pd
from flask import url_for

from depmap.context_explorer import enrichment_tile_filters, utils
from depmap.context.models_new import (
    NodeBranchModelsResult,
    SubtypeNode,
    SubtypeContext,
)
from depmap.context_explorer.models import ContextPlotBoxData, BoxData, NodeEntityData


def _get_node_entity_data(
    dataset_given_id: str, feature_type: str, feature_id: str
) -> NodeEntityData:
    feature_id_and_label = utils.get_feature_id_from_full_label(
        feature_type=feature_type, feature_id=feature_id
    )

    feature_id = feature_id_and_label["feature_id"]
    label = feature_id_and_label["label"]
    entity_overview_page_label = feature_id_and_label["entity_overview_page_label"]

    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_given_id=dataset_given_id, feature_id=feature_id
    )
    entity_full_row_of_values.dropna(inplace=True)

    return NodeEntityData(
        feature_id=feature_id,
        label=label,
        feature_full_row_of_values=entity_full_row_of_values,
        feature_overview_page_label=entity_overview_page_label,
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


def get_branch_subtype_codes_organized_by_code(
    sig_contexts: Dict[str, List[str]],
) -> Tuple[Dict[str, Optional[Dict[str, List[str]]]], List[str], Dict[str, str]]:
    branch_contexts: Dict[str, Optional[Dict[str, List[str]]]] = {}
    all_sig_models: List[str] = []
    all_codes_to_node_name: Dict[str, str] = {}

    for level_0 in sig_contexts.keys():
        child_nodes: List[
            SubtypeNode
        ] = SubtypeNode.get_children_using_current_level_code(level_0, 0)
        child_codes: List[str] = [str(node.subtype_code) for node in child_nodes]

        result: NodeBranchModelsResult = SubtypeContext.get_model_ids_for_node_branch(
            subtype_codes=child_codes, level_0_subtype_code=level_0,
        )

        if result.all_model_ids:
            all_sig_models.extend(result.all_model_ids)

        branch_contexts[level_0] = result.node_models
        all_codes_to_node_name.update(result.codes_to_node_name)

    return branch_contexts, all_sig_models, all_codes_to_node_name


def get_sig_context_dataframe(
    tree_type: str,
    feature_type: str,
    feature_id: str,  # entrez_id for genes. compound_id for compounds.
    dataset_given_id: str,
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
            feature_type=feature_type, dataset_given_id=dataset_given_id
        )

    # If this doesn't find the node, something is wrong with how we
    # loaded the SubtypeNode database table data.
    sig_contexts = ContextAnalysis.get_context_dependencies(
        tree_type=tree_type,
        feature_id=feature_id,
        dataset_given_id=dataset_given_id,
        feature_type=feature_type,
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
            child_codes = [str(node.subtype_code) for node in child_nodes]
            selected_context_level_0 = SubtypeContext.get_model_ids_for_node_branch(
                subtype_codes=child_codes, level_0_subtype_code=level_0
            ).node_models

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


def _build_significant_cards_and_mappings(
    sig_contexts: pd.DataFrame,
    selected_level_0: str,
    entity_full_row_of_values: pd.Series,
    ordered_sig_context_codes: List[str],
) -> Tuple[
    Optional[Any], List[Any], List[str], Dict[str, str],
]:
    """Build box plot cards for the selected and secondary branches, plus model/name lookups."""
    sig_contexts_by_level_0 = get_significant_context_codes_indexed_by_level_0(
        sig_contexts=sig_contexts
    )
    (
        branch_contexts,
        all_sig_models,
        branch_codes_to_node_name,
    ) = get_branch_subtype_codes_organized_by_code(sig_contexts=sig_contexts_by_level_0)

    selected_card = get_card_data(
        level_0=selected_level_0,
        branch_contexts=branch_contexts,
        entity_full_row_of_values=entity_full_row_of_values,
        ordered_sig_subtype_codes=ordered_sig_context_codes,
    )

    other_cards: List[Any] = []
    for other_level_0 in branch_contexts.keys():
        if other_level_0 == selected_level_0:
            continue

        other_card = get_card_data(
            level_0=other_level_0,
            branch_contexts=branch_contexts,
            entity_full_row_of_values=entity_full_row_of_values,
            ordered_sig_subtype_codes=ordered_sig_context_codes,
        )
        if other_card is not None:
            other_cards.append(other_card)

    return selected_card, other_cards, all_sig_models, branch_codes_to_node_name


def _resolve_level_0_mapping(
    level_0: str, existing_mapping: Dict[str, str]
) -> Dict[str, str]:
    """Ensure the primary level_0 code has a display name even when sig_contexts is empty."""
    if not level_0 or level_0 in existing_mapping:
        return {}

    level_0_context: Optional[SubtypeNode] = SubtypeNode.get_by_code(
        level_0, must=False
    )
    if level_0_context is None:
        return {}

    return {level_0: str(level_0_context.node_name)}


def get_context_plot_box_data(
    dataset_given_id: str,
    feature_type: str,
    feature_id: str,
    sig_contexts: pd.DataFrame,
    level_0: str,
    tree_type: str,
) -> Optional[ContextPlotBoxData]:
    """Assemble box plot distributions, reference lines, and code-to-name metadata."""
    # 1. Fetch feature metadata and non-null measurement values across models
    node_entity_data = _get_node_entity_data(
        dataset_given_id=dataset_given_id,
        feature_type=feature_type,
        feature_id=feature_id,
    )
    entity_full_row_of_values = utils.get_full_row_of_values_and_depmap_ids(
        dataset_given_id=dataset_given_id, feature_id=feature_id
    ).dropna()

    # Compounds display a global mean reference line across all cell lines
    drug_dotted_line: Optional[float] = (
        float(entity_full_row_of_values.mean()) if feature_type == "compound" else None
    )

    # 2. Rank significant contexts and build per-branch box plot cards
    has_sig_contexts = len(sig_contexts) > 0
    ordered_sig_context_codes: List[str] = (
        get_all_significant_context_codes_ordered_by_significance(
            sig_contexts=sig_contexts
        )
        if has_sig_contexts
        else []
    )

    if has_sig_contexts:
        (
            selected_card,
            other_box_plot_data,
            all_sig_models,
            branch_codes_to_node_name,
        ) = _build_significant_cards_and_mappings(
            sig_contexts=sig_contexts,
            selected_level_0=level_0,
            entity_full_row_of_values=entity_full_row_of_values,
            ordered_sig_context_codes=ordered_sig_context_codes,
        )
    else:
        selected_card = None
        other_box_plot_data = []
        all_sig_models = []
        branch_codes_to_node_name = {}

    # 3. Combine branch code-to-name mappings with a fallback for the selected level_0
    codes_to_node_name: Dict[str, str] = (
        _resolve_level_0_mapping(level_0, branch_codes_to_node_name)
        | branch_codes_to_node_name
    )

    # 4. Compute baseline box plots for remaining (non-significant) solid and heme models
    solid_and_heme_box_data = get_box_plot_data_for_other_category(
        all_sig_context_codes=set(ordered_sig_context_codes),
        entity_full_row_of_values=entity_full_row_of_values,
        tree_type=tree_type,
        all_sig_models=set(all_sig_models),
    )

    dataset_units = data_access.get_dataset_units(dataset_id=dataset_given_id)
    assert dataset_units is not None

    return ContextPlotBoxData(
        significant_selection=selected_card.significant if selected_card else None,
        insignificant_selection=selected_card.insignificant if selected_card else None,
        other_cards=other_box_plot_data,
        insignificant_heme_data=solid_and_heme_box_data.heme,
        insignificant_solid_data=solid_and_heme_box_data.solid,
        drug_dotted_line=drug_dotted_line,
        feature_label=node_entity_data.label,
        feature_overview_page_label=node_entity_data.feature_overview_page_label,
        dataset_units=dataset_units,
        codes_to_node_name=codes_to_node_name,
    )


def _order_cards_by_significance(
    cards: List[Any], sig_contexts: pd.DataFrame,
) -> List[Any]:
    """Arrange secondary cards in the exact order their level_0 codes appear in sig_contexts."""
    if sig_contexts.empty or not cards:
        return cards

    cards_by_level_0: Dict[str, Any] = {card.level_0_code: card for card in cards}
    ordered_level_0_codes: List[str] = (
        sig_contexts["level_0"].drop_duplicates(keep="first").tolist()
    )

    return [
        cards_by_level_0[code]
        for code in ordered_level_0_codes
        if code in cards_by_level_0
    ]


def get_organized_contexts(
    selected_subtype_code: str,
    sig_contexts: pd.DataFrame,
    feature_type: str,
    feature_id: str,
    dataset_given_id: str,
    tree_type: str,
) -> Optional[ContextPlotBoxData]:
    """Fetch context plot box data for the selected subtype's lineage and order secondary cards."""
    node: Optional[SubtypeNode] = SubtypeNode.get_by_code(selected_subtype_code)
    assert node is not None

    context_box_plot_data: Optional[ContextPlotBoxData] = get_context_plot_box_data(
        dataset_given_id=dataset_given_id,
        feature_type=feature_type,
        feature_id=feature_id,
        sig_contexts=sig_contexts,
        level_0=node.level_0,
        tree_type=tree_type,
    )

    if context_box_plot_data is None:
        return None

    ordered_other_cards: List[Any] = _order_cards_by_significance(
        cards=context_box_plot_data.other_cards, sig_contexts=sig_contexts,
    )

    return ContextPlotBoxData(
        significant_selection=context_box_plot_data.significant_selection,
        insignificant_selection=context_box_plot_data.insignificant_selection,
        other_cards=ordered_other_cards,
        insignificant_heme_data=context_box_plot_data.insignificant_heme_data,
        insignificant_solid_data=context_box_plot_data.insignificant_solid_data,
        drug_dotted_line=context_box_plot_data.drug_dotted_line,
        feature_label=context_box_plot_data.feature_label,
        feature_overview_page_label=context_box_plot_data.feature_overview_page_label,
        dataset_units=context_box_plot_data.dataset_units,
        codes_to_node_name=context_box_plot_data.codes_to_node_name,
    )


################################################################################
### Enrichment Tile Boxplots (shown on the Gene and Compound overview pages) ###
################################################################################


def get_gene_enriched_lineages_feature_dataset_metadata(
    feature_id: str,
) -> Optional[dict]:
    gene = Gene.get_gene_by_entrez(int(feature_id))

    assert gene is not None

    dataset = data_access.get_matrix_dataset(
        ContextExplorerDatasets.Chronos_Combined.value
    )
    if dataset is None:
        return None

    dataset_name = dataset.given_id
    dataset_display_name = dataset.label

    return {
        "feature_id": feature_id,
        "dataset_given_id": dataset_name,
        "label": gene.label,
        "dataset_display_name": dataset_display_name,
    }


def get_compound_enriched_lineages_feature_id_and_dataset_name(
    compound_id: str,
) -> dict:
    compound = Compound.get_by_label(compound_id)

    possible_datasets = data_access.get_all_datasets_containing_compound(
        compound_id=compound.compound_id
    )

    possible_datasets_w_compound = [
        dataset
        for dataset in possible_datasets
        if dataset.given_id is not None
        and data_access.valid_row(dataset_id=dataset.given_id, row_name=compound.label)
        and dataset.given_id in ContextExplorerDatasets.values()
    ]

    assert len(possible_datasets_w_compound) > 0

    priority_dataset = possible_datasets_w_compound[0]
    dataset_display_name = priority_dataset.label
    dataset_given_id = priority_dataset.given_id

    return {
        "feature_id": compound.compound_id,
        "dataset_given_id": dataset_given_id,
        "label": compound.label,
        "dataset_display_name": dataset_display_name,
    }


def get_data_to_show_if_no_contexts_significant(
    feature_type: str, feature_id: str, tree_type: str, dataset_given_id: str
):
    feature_id_and_label = utils.get_feature_id_from_full_label(
        feature_type=feature_type, feature_id=feature_id
    )
    feature_label = feature_id_and_label["label"]
    entity_overview_page_label = feature_id_and_label["entity_overview_page_label"]

    entity_overview_page_label = feature_id_and_label["entity_overview_page_label"]
    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_given_id=dataset_given_id, feature_id=feature_id
    )
    entity_full_row_of_values.dropna(inplace=True)
    drug_dotted_line = (
        entity_full_row_of_values.mean() if feature_type == "compound" else None
    )

    grouped_other_box_plot_data = get_box_plot_data_for_other_category(
        all_sig_context_codes=set(),
        entity_full_row_of_values=entity_full_row_of_values,
        tree_type=tree_type,
        all_sig_models=set(),
    )
    heme_box_plot_data = grouped_other_box_plot_data.heme

    solid_box_plot_data = grouped_other_box_plot_data.solid

    dataset_units = data_access.get_dataset_units(dataset_id=dataset_given_id)
    dataset_display_name = data_access.get_dataset_label(dataset_id=dataset_given_id)
    assert dataset_units is not None

    ordered_box_plot_data = ContextPlotBoxData(
        significant_selection=[],
        insignificant_selection=None,
        other_cards=[],
        insignificant_heme_data=heme_box_plot_data,
        insignificant_solid_data=solid_box_plot_data,
        drug_dotted_line=drug_dotted_line,
        feature_label=feature_label,
        feature_overview_page_label=entity_overview_page_label,
        dataset_units=dataset_units,
    )

    tile_data = EnrichedLineagesTileData(
        box_plot_data=ordered_box_plot_data,
        top_context_name_info=None,
        selected_context_name_info=None,
        dataset_name=dataset_given_id,
        dataset_display_name=dataset_display_name,
        context_explorer_url=url_for("context_explorer.view_context_explorer"),
    )

    return dataclasses.asdict(tile_data)
