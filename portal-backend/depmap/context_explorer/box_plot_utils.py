from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional
from depmap.cell_line.models_new import DepmapModel
from depmap.context_explorer.models import ContextAnalysis
import pandas as pd

from depmap.context_explorer import utils
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

    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)

    return NodeEntityData(
        entity_id=entity_id,
        entity_label=entity_label,
        entity_full_row_of_values=entity_full_row_of_values,
    )


def get_box_plot_card_data(
    level_0_code: str,
    all_sig_context_codes: List[str],
    model_ids_by_code: Dict[str, List[str]],
    entity_full_row_of_values: pd.Series,
):
    significant_box_plot_data = {}
    insignificant_box_plot_data = {}
    all_sig_models = []
    codes_with_less_than_5_models = []

    child_codes = model_ids_by_code.keys()

    for child in child_codes:
        if child in all_sig_context_codes:
            context_model_ids = model_ids_by_code[child]
            # This rule should be enforced in get_context_analysis.py. If this assertion gets hit,
            # something is wrong with our pipeline script.
            if len(context_model_ids) >= 5:
                box_plot = get_box_plot_data_for_context(
                    subtype_code=child,
                    entity_full_row_of_values=entity_full_row_of_values,
                    model_ids=context_model_ids,
                )
                significant_box_plot_data[child] = box_plot
                all_sig_models.extend(context_model_ids)
            else:
                codes_with_less_than_5_models.extend(context_model_ids)

    if level_0_code not in all_sig_context_codes:
        if len(all_sig_models) >= 5:
            significant_box_plot_data[level_0_code] = get_box_plot_data_for_context(
                subtype_code=level_0_code,
                entity_full_row_of_values=entity_full_row_of_values,
                model_ids=all_sig_models,
            )

            level_0_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
                level_0_code, 0
            )
            level_0_model_ids.extend(codes_with_less_than_5_models)

            all_other_model_ids = list(set(level_0_model_ids) - set(all_sig_models))
            insignificant_box_plot_data = (
                {f"Other {level_0_code}": []}
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
            {f"Other {level_0_code}": []}
            if len(codes_with_less_than_5_models) < 5
            else get_box_plot_data_for_context(
                label=f"Other {level_0_code}",
                subtype_code=level_0_code,
                entity_full_row_of_values=entity_full_row_of_values,
                model_ids=codes_with_less_than_5_models,
            )
        )

    return {
        "significant": significant_box_plot_data,
        "insignificant": insignificant_box_plot_data,
        "level_0_code": level_0_code,
    }


def get_box_plot_data_for_other_category(
    category: Literal["heme", "solid"],
    significant_subtype_codes: List[str],
    entity_full_row_of_values,
) -> str:
    heme_model_id_series = (
        SubtypeContext.get_model_ids_for_other_heme_contexts(
            subtype_codes_to_filter_out=significant_subtype_codes
        )
        if category == "heme"
        else SubtypeContext.get_model_ids_for_other_solid_contexts(
            subtype_codes_to_filter_out=significant_subtype_codes
        )
    )

    if heme_model_id_series.empty:
        return BoxData(
            label="Other Heme" if category == "heme" else "Other Solid",
            data=[],
            cell_line_display_names=[],
        )

    heme_model_ids = list(heme_model_id_series.keys())
    heme_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(heme_model_ids)
    ]

    heme_values.dropna(inplace=True)

    display_names_series = DepmapModel.get_cell_line_display_names(
        model_ids=heme_model_ids
    )
    display_names_dict = display_names_series.to_dict()

    context_values_index_by_display_name = heme_values.rename(index=display_names_dict)

    return BoxData(
        label="Other Heme" if category == "heme" else "Other Solid",
        data=context_values_index_by_display_name.tolist(),
        cell_line_display_names=context_values_index_by_display_name.index.tolist(),
    )


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
    path = utils.get_path_to_node(node.subtype_code).path
    path = path[1:] if len(path) > 1 else path
    delim = "/"

    plotLabel = delim.join(path) if not label else label

    box_plot_data = {
        "label": plotLabel,
        "path": path,
        "data": context_values_index_by_display_name.tolist(),
        "cell_line_display_names": context_values_index_by_display_name.index.tolist(),
    }

    return box_plot_data


def get_branch_subtype_codes_organized_by_code(
    contexts: Dict[str, List[str]], level_0: str
):
    branch_contexts = {}
    for level_0 in contexts.keys():
        branch = SubtypeContext.get_model_ids_for_node_branch(
            subtype_codes=contexts[level_0], level_0_subtype_code=level_0
        )

        branch_contexts[level_0] = branch

    return branch_contexts


def _get_sig_context_dataframe(
    tree_type: str,
    entity_type: str,
    entity_id: str,
    dataset_name: str,
    fdr: List[float],
    abs_effect_size: List[float],
    frac_dep_in: List[float],
) -> pd.DataFrame:
    # If this doesn't find the node, something is wrong with how we
    # loaded the SubtypeNode database table data.
    sig_contexts = ContextAnalysis.get_context_dependencies(
        tree_type=tree_type,
        entity_id=entity_id,
        dataset_name=dataset_name,
        entity_type=entity_type,
        fdr=fdr,
        abs_effect_size=abs_effect_size,
        frac_dep_in=frac_dep_in,
    )

    return sig_contexts


def get_card_data(
    level_0: str,
    branch_contexts: dict,
    node_entity_data: NodeEntityData,
    all_sig_context_codes: List[str],
    entity_full_row_of_values: pd.Series,
):
    # These are all the level_0 codes that need a box plot "card," but these
    # codes aren't necessarily all significant. If a code appears in this list,
    # either the code and/or 1 or more of it's children are significant.
    if branch_contexts != None:
        assert (
            level_0 in branch_contexts.keys()
        ), f" level_0: {level_0}, entity_label {node_entity_data.entity_label}, node {node_entity_data.selected_node.node_name}"
        selected_context_level_0 = branch_contexts[level_0]
        if selected_context_level_0 != None:
            box_plot_card_data = get_box_plot_card_data(
                level_0_code=level_0,
                all_sig_context_codes=all_sig_context_codes,
                model_ids_by_code=selected_context_level_0,
                entity_full_row_of_values=entity_full_row_of_values,
            )

            return box_plot_card_data


def get_context_plot_box_data(
    sig_contexts: pd.DataFrame,
    level_0: str,
    node_entity_data: NodeEntityData,
    entity_full_row_of_values: pd.Series,
    drug_dotted_line: Any,
) -> Optional[ContextPlotBoxData]:
    heme_box_plot_data = {}
    solid_box_plot_data = {}
    other_box_plot_data = []
    selected_sig_box_plot_card_data = {}
    if len(sig_contexts) > 0:
        all_sig_context_codes = sig_contexts["subtype_code"].to_list()
        sig_contexts_agg = (
            sig_contexts.groupby("level_0").agg({"subtype_code": list}).reset_index()
        )
        sig_contexts_by_level_0 = sig_contexts_agg.set_index("level_0").to_dict()[
            "subtype_code"
        ]
        branch_contexts = get_branch_subtype_codes_organized_by_code(
            contexts=sig_contexts_by_level_0, level_0=level_0
        )
        selected_sig_box_plot_card_data = get_card_data(
            level_0=level_0,
            branch_contexts=branch_contexts,
            node_entity_data=node_entity_data,
            all_sig_context_codes=all_sig_context_codes,
            entity_full_row_of_values=entity_full_row_of_values,
        )

        all_level_0_codes = branch_contexts.keys()
        for other_level_0 in all_level_0_codes:
            if level_0 != other_level_0:
                other_sig_data = get_card_data(
                    level_0=other_level_0,
                    branch_contexts=branch_contexts,
                    node_entity_data=node_entity_data,
                    all_sig_context_codes=all_sig_context_codes,
                    entity_full_row_of_values=entity_full_row_of_values,
                )
                if other_sig_data is not None:
                    other_box_plot_data.append(other_sig_data)

        heme_box_plot_data = get_box_plot_data_for_other_category(
            category="heme",
            significant_subtype_codes=all_sig_context_codes,
            entity_full_row_of_values=entity_full_row_of_values,
        )

        solid_box_plot_data = get_box_plot_data_for_other_category(
            category="solid",
            significant_subtype_codes=all_sig_context_codes,
            entity_full_row_of_values=entity_full_row_of_values,
        )

        significant_selection = (
            None
            if not selected_sig_box_plot_card_data
            else selected_sig_box_plot_card_data["significant"]
        )
        insignifcant_selection = (
            None
            if not selected_sig_box_plot_card_data
            else selected_sig_box_plot_card_data["insignificant"]
        )

        return ContextPlotBoxData(
            significant_selection=significant_selection,
            insignifcant_selection=insignifcant_selection,
            other_cards=other_box_plot_data,
            insignificant_heme_data=heme_box_plot_data,
            insignificant_solid_data=solid_box_plot_data,
            drug_dotted_line=drug_dotted_line,
            entity_label=node_entity_data.entity_label,
        )

    return None


def get_organized_contexts(
    selected_subtype_code: str,
    tree_type: str,
    entity_type: str,
    entity_full_label: str,
    dataset_name: str,
    fdr: List[float],
    abs_effect_size: List[float],
    frac_dep_in: List[float],
) -> ContextPlotBoxData:
    level_0 = SubtypeNode.get_by_code(selected_subtype_code).level_0
    node_entity_data = _get_node_entity_data(
        dataset_name=dataset_name,
        entity_type=entity_type,
        entity_full_label=entity_full_label,
    )

    entity_full_row_of_values = node_entity_data.entity_full_row_of_values

    sig_contexts = _get_sig_context_dataframe(
        tree_type=tree_type,
        entity_type=entity_type,
        entity_id=node_entity_data.entity_id,
        dataset_name=dataset_name,
        fdr=fdr,
        abs_effect_size=abs_effect_size,
        frac_dep_in=frac_dep_in,
    )
    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=node_entity_data.entity_label
    )
    entity_full_row_of_values.dropna(inplace=True)

    drug_dotted_line = (
        entity_full_row_of_values.mean() if entity_type == "compound" else None
    )

    context_box_plot_data = get_context_plot_box_data(
        sig_contexts=sig_contexts,
        level_0=level_0,
        node_entity_data=node_entity_data,
        entity_full_row_of_values=entity_full_row_of_values,
        drug_dotted_line=drug_dotted_line,
    )

    return context_box_plot_data
