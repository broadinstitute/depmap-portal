from xmlrpc.client import boolean
from flask import url_for
from typing import Dict, List, Literal, Optional
from depmap.cell_line.models_new import DepmapModel
import pandas as pd
import numpy as np

from depmap import data_access
from depmap.context.models_new import SubtypeNode, SubtypeContext
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.compound.models import (
    CompoundExperiment,
    CompoundDoseReplicate,
    DoseResponseCurve,
    Compound,
)
from depmap.gene.models import Gene
import re


def get_full_row_of_values_and_depmap_ids(dataset_name: str, label: str) -> pd.Series:
    full_row_of_values = data_access.get_row_of_values(
        dataset_id=dataset_name, feature=label
    )

    if full_row_of_values.empty:
        return pd.Series()

    return full_row_of_values


def get_box_plot_card_data(
    level_0_code: str,
    all_sig_context_codes: List[str],
    model_ids_by_code: Dict[str, List[str]],
    entity_full_row_of_values: pd.Series,
    include_level_0: bool = True,
):
    significant_box_plot_data = {}
    all_sig_models = []

    child_codes = model_ids_by_code.keys()
    for child in child_codes:
        if child in all_sig_context_codes:
            context_model_ids = model_ids_by_code[child]
            # This rule should be enforced in get_context_analysis.py. If this assertion gets hit,
            # something is wrong with our pipeline script.
            if len(context_model_ids) >= 5:
                if include_level_0 or child != level_0_code:
                    box_plot = get_box_plot_data_for_context(
                        subtype_code=child,
                        entity_full_row_of_values=entity_full_row_of_values,
                        model_ids=context_model_ids,
                    )
                    significant_box_plot_data[child] = box_plot
                all_sig_models.extend(context_model_ids)

    all_other_model_ids = list(
        set(entity_full_row_of_values.index.tolist()) - set(all_sig_models)
    )
    if len(all_other_model_ids) >= 5:
        insignificant_box_plot_data = get_box_plot_data_for_context(
            label=f"Other {level_0_code}",
            subtype_code=level_0_code,
            entity_full_row_of_values=entity_full_row_of_values,
            model_ids=all_other_model_ids,
        )

    return {
        "significant": significant_box_plot_data,
        "insignificant": insignificant_box_plot_data,
    }


def get_box_plot_data_for_other_category(
    category: Literal["heme", "solid"],
    significant_subtype_codes: List[str],
    entity_full_row_of_values,
):
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
        return {
            "label": "Other Heme" if category == "heme" else "Other Solid",
            "data": [],
            "cell_line_display_names": [],
        }

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

    return {
        "label": "Other Heme" if category == "heme" else "Other Solid",
        "data": context_values_index_by_display_name.tolist(),
        "cell_line_display_names": context_values_index_by_display_name.index.tolist(),
    }


def get_path_to_node(selected_code: str):
    node_obj = SubtypeNode.get_by_code(selected_code)

    cols = [
        node_obj.level_0,
        node_obj.level_1,
        node_obj.level_2,
        node_obj.level_3,
        node_obj.level_4,
        node_obj.level_5,
    ]
    path = [col for col in cols if col != None]

    return path


def get_box_plot_data_for_context(
    subtype_code: str,
    entity_full_row_of_values,
    model_ids: List[str],
    label: Optional[str] = None,
):
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
    path = get_path_to_node(node.subtype_code)
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


def get_curve_params_for_model_ids(
    compound_experiment: CompoundExperiment,
    model_ids: List[str],
    model_display_names_by_model_id: pd.Series,
):
    curve_objs = DoseResponseCurve.get_curve_params(
        compound_experiment=compound_experiment, model_ids=model_ids
    )

    curve_params = []
    for curve in curve_objs:
        if curve is not None:
            curve_param = {
                "id": curve.depmap_id,
                "displayName": model_display_names_by_model_id.loc[curve.depmap_id],
                "ec50": curve.ec50,
                "slope": curve.slope,
                "lowerAsymptote": curve.lower_asymptote,
                "upperAsymptote": curve.upper_asymptote,
            }
            curve_params.append(curve_param)

    return curve_params


def _get_dose_response_curves_per_model(
    in_group_model_ids: Dict[str, str],
    out_group_model_ids: List[str],
    replicate_dataset_name: str,
    compound_experiment: CompoundExperiment,
):
    dataset = Dataset.get_dataset_by_name(replicate_dataset_name)

    dose_min_max_df = CompoundDoseReplicate.get_dose_min_max_of_replicates_with_compound_experiment_id(
        compound_experiment.entity_id
    )
    compound_dose_replicates = [
        dose_rep
        for dose_rep in dose_min_max_df
        if DependencyDataset.has_entity(dataset.name, dose_rep.entity_id)
    ]

    in_group_curve_params = get_curve_params_for_model_ids(
        model_ids=in_group_model_ids,
        model_display_names_by_model_id=pd.Series(
            data=in_group_model_ids, index=in_group_model_ids
        ),
        compound_experiment=compound_experiment,
    )

    out_group_model_display_names = DepmapModel.get_cell_line_display_names(
        list(set(out_group_model_ids))
    )
    out_group_curve_params = get_curve_params_for_model_ids(
        model_ids=out_group_model_ids,
        model_display_names_by_model_id=out_group_model_display_names,
        compound_experiment=compound_experiment,
    )

    return {
        "in_group_curve_params": in_group_curve_params,
        "out_group_curve_params": out_group_curve_params,
        "max_dose": compound_dose_replicates[0].max_dose,
        "min_dose": compound_dose_replicates[0].min_dose,
    }


def _get_out_group_model_ids(out_group_type, dataset_name, in_group_model_ids, label):
    (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=label
    )
    entity_full_row_of_values.dropna(inplace=True)
    if out_group_type == "All Others" or out_group_type == "All":
        return entity_full_row_of_values[
            ~entity_full_row_of_values.index.isin(in_group_model_ids)
        ].index.tolist()
    else:
        raise NotImplementedError(
            "Need to implement logic for getting model ids for none 'All Others' outgroup types"
        )


def _get_compound_experiment_id_from_entity_label(entity_full_label: str):
    m = re.search(r"([A-Z0-9]*:[A-Z0-9-]*)", entity_full_label)
    compound_experiment_id = m.group(1)

    return compound_experiment_id


def _get_compound_experiment(entity_full_label: str):
    compound_experiment_id = _get_compound_experiment_id_from_entity_label(
        entity_full_label=entity_full_label
    )

    assert ":" in compound_experiment_id
    compound_experiment = CompoundExperiment.get_by_xref_full(
        compound_experiment_id, must=False
    )

    return compound_experiment


def get_entity_id_from_entity_full_label(
    entity_type: str, entity_full_label: str
) -> dict:
    entity = None
    if entity_type == "gene":
        m = re.match("\\S+ \\((\\d+)\\)", entity_full_label)

        assert m is not None
        entrez_id = int(m.group(1))
        gene = Gene.get_gene_by_entrez(entrez_id)
        assert gene is not None
        label = gene.label
        entity = gene
        entity_id = entity.entity_id
    else:
        compound_experiment = _get_compound_experiment(
            entity_full_label=entity_full_label
        )
        entity_id = compound_experiment.entity_id
        label = Compound.get_by_entity_id(entity_id).label

    return {"entity_id": entity_id, "label": label}


def _get_in_group_out_group_model_ids(
    dataset_name: str,
    entity_full_label: str,
    subtype_code: str,
    level: int,
    out_group_type: str,
):
    in_group_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
        subtype_code, level
    )

    out_group_model_ids = _get_out_group_model_ids(
        out_group_type,
        dataset_name=dataset_name,
        in_group_model_ids=in_group_model_ids,
        label=entity_full_label,
    )

    return {
        "in_group_model_ids": in_group_model_ids,
        "out_group_model_ids": out_group_model_ids,
    }


# Separated out for testing purposes
def get_context_dose_curves(
    dataset_name: str,
    entity_full_label: str,
    subtype_code: str,
    level: int,
    out_group_type: str,
):
    assert dataset_name == DependencyDataset.DependencyEnum.Prism_oncology_AUC.name
    dataset = DependencyDataset.get_dataset_by_name(dataset_name)
    replicate_dataset_name = dataset.get_dose_replicate_enum().name
    compound_experiment = _get_compound_experiment(entity_full_label=entity_full_label)

    in_group_out_group_model_ids = _get_in_group_out_group_model_ids(
        dataset_name=dataset_name,
        entity_full_label=entity_full_label,
        subtype_code=subtype_code,
        level=level,
        out_group_type=out_group_type,
    )

    dose_curve_info = _get_dose_response_curves_per_model(
        in_group_model_ids=in_group_out_group_model_ids["in_group_model_ids"],
        out_group_model_ids=in_group_out_group_model_ids["out_group_model_ids"],
        replicate_dataset_name=replicate_dataset_name,
        compound_experiment=compound_experiment,
    )

    return {
        "dataset": dataset,
        "compound_experiment": compound_experiment,
        "replicate_dataset_name": replicate_dataset_name,
        "dose_curve_info": dose_curve_info,
    }
