import math
from typing import Dict, List, Literal
from depmap.cell_line.models_new import DepmapModel, LineageType
import pandas as pd
import numpy as np

from depmap import data_access
from scipy.ndimage import uniform_filter1d
from depmap.context.models import Context
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.compound.models import (
    CompoundExperiment,
    CompoundDoseReplicate,
    DoseResponseCurve,
)
from depmap.context_explorer.models import (
    BoxPlotTypes,
    ContextAnalysis,
)


def get_full_row_of_values_and_depmap_ids(dataset_id: str, entity_id: int) -> pd.Series:
    full_row_of_values_df = data_access.get_subsetted_df_by_ids(
        dataset_id=dataset_id, entity_ids=[entity_id], cell_line_ids=None,
    )
    full_row_of_values = (
        pd.Series() if full_row_of_values_df.empty else full_row_of_values_df.iloc[0, :]
    )

    return full_row_of_values


def get_other_context_dependencies(
    dataset_id: str,
    in_group: str,
    out_group_type: str,
    entity_type: Literal["gene", "compound"],
    entity_id: int,
    fdr: List[float],
    abs_effect_size: List[float],
    frac_dep_in: List[float],
):

    other_context_dependencies = ContextAnalysis.get_other_context_dependencies(
        context_name=in_group,
        out_group=out_group_type,
        entity_id=entity_id,
        entity_type=entity_type,
        fdr=fdr,
        abs_effect_size=abs_effect_size,
        frac_dep_in=frac_dep_in,
    )

    other_ctxt_dep_names = [dep[0] for dep in other_context_dependencies]

    box_plot_data = []
    for other_dep_name in other_ctxt_dep_names:
        # Not sure how to tell whether the name is a primary_disease or lineage other than trying both
        depmap_ids_names_dict = DepmapModel.get_model_ids_by_primary_disease(
            other_dep_name
        )

        if not depmap_ids_names_dict:
            depmap_ids_names_dict = DepmapModel.get_model_ids_by_lineage_and_level(
                other_dep_name
            )

        full_row_of_values = get_full_row_of_values_and_depmap_ids(
            dataset_id=dataset_id, entity_id=entity_id
        )

        box_plot_values = full_row_of_values[
            full_row_of_values.index.isin(depmap_ids_names_dict.keys())
        ]
        box_plot_values.dropna(inplace=True)
        box_plot_values_by_display_name = box_plot_values.rename(
            index=depmap_ids_names_dict
        )
        display_name = Context.get_display_name(other_dep_name)
        box_plot_data.append(
            {
                "name": display_name,
                "type": BoxPlotTypes.Other.value,
                "data": box_plot_values_by_display_name.tolist(),
                "cell_line_display_names": box_plot_values_by_display_name.index.tolist(),
            }
        )

    return box_plot_data


def _get_same_and_other_lineage_type_values(
    lineage_type: LineageType, entity_full_row_of_values, selected_lineage_name: str,
):
    opposite_type = (
        LineageType.Solid if lineage_type == LineageType.Heme else LineageType.Heme
    )
    same_lineage_type_depmap_ids_dict = DepmapModel.get_model_ids_by_lineage_type_filtering_out_specific_lineage(
        lineage_type, selected_lineage_name
    )

    same_lineage_type_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(same_lineage_type_depmap_ids_dict.keys())
    ]
    same_lineage_type_values.dropna(inplace=True)
    same_lineage_type_values_by_display_name = same_lineage_type_values.rename(
        index=same_lineage_type_depmap_ids_dict
    )

    other_lineage_type_depmap_ids_dict = DepmapModel.get_model_ids_by_lineage_type_filtering_out_specific_lineage(
        opposite_type, selected_lineage_name
    )
    other_lineage_type_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(other_lineage_type_depmap_ids_dict.keys())
    ]
    other_lineage_type_values.dropna(inplace=True)
    other_lineage_type_values_by_display_name = other_lineage_type_values.rename(
        index=other_lineage_type_depmap_ids_dict
    )

    return (
        same_lineage_type_values_by_display_name,
        other_lineage_type_values_by_display_name,
    )


def _get_lineage_type_from_top_context(top_context: str):
    lineage_type = (
        LineageType.Solid
        if top_context.lower() != "myeloid" and top_context.lower() != "lymphoid"
        else LineageType.Heme
    )

    return lineage_type


def _get_lineage_type_box_plot_data(top_context: str, entity_full_row_of_values):
    box_plot_data = []
    lineage_type = _get_lineage_type_from_top_context(top_context=top_context)

    (
        same_lineage_type_values_by_display_name,
        other_lineage_type_values_by_display_name,
    ) = _get_same_and_other_lineage_type_values(
        lineage_type=lineage_type,
        entity_full_row_of_values=entity_full_row_of_values,
        selected_lineage_name=top_context,
    )

    box_plot_data.append(
        {
            "type": BoxPlotTypes.SameLineageType.value,
            "data": same_lineage_type_values_by_display_name.tolist(),
            "cell_line_display_names": same_lineage_type_values_by_display_name.index.tolist(),
        }
    )

    box_plot_data.append(
        {
            "type": BoxPlotTypes.OtherLineageType.value,
            "data": other_lineage_type_values_by_display_name.tolist(),
            "cell_line_display_names": other_lineage_type_values_by_display_name.index.tolist(),
        }
    )

    return box_plot_data


def get_box_plot_data_for_selected_lineage(
    lineage_depmap_ids: List[str],
    entity_full_row_of_values,
    top_context: str,
    lineage_depmap_ids_names_dict: Dict[str, str],
):
    box_plot_data = []
    lineage_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(lineage_depmap_ids)
    ]
    lineage_values.dropna(inplace=True)
    lineage_values_index_by_display_name = lineage_values.rename(
        index=lineage_depmap_ids_names_dict
    )

    box_plot_data.append(
        {
            "type": BoxPlotTypes.SelectedLineage.value,
            "data": lineage_values_index_by_display_name.tolist(),
            "cell_line_display_names": lineage_values_index_by_display_name.index.tolist(),
        }
    )

    lineage_type_box_plot_data = _get_lineage_type_box_plot_data(
        top_context=top_context, entity_full_row_of_values=entity_full_row_of_values,
    )

    return box_plot_data + lineage_type_box_plot_data


def get_box_plot_data_for_primary_disease(
    selected_context: str,
    top_context: str,
    lineage_depmap_ids: List[str],
    entity_full_row_of_values,
    lineage_depmap_ids_names_dict: Dict[str, str],
):
    box_plot_data = []
    primary_disease_depmap_ids_names_dict = DepmapModel.get_model_ids_by_primary_disease(
        selected_context
    )
    primary_disease_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(
            primary_disease_depmap_ids_names_dict.keys()
        )
    ]
    primary_disease_values.dropna(inplace=True)

    primary_disease_values_index_by_display_name = primary_disease_values.rename(
        index=primary_disease_depmap_ids_names_dict
    )

    box_plot_data.append(
        {
            "type": BoxPlotTypes.SelectedPrimaryDisease.value,
            "data": primary_disease_values_index_by_display_name.tolist(),
            "cell_line_display_names": primary_disease_values_index_by_display_name.index.tolist(),
        }
    )

    # e.g. Other Bone
    same_lineage_ids = [
        i
        for i in lineage_depmap_ids
        if not i in primary_disease_depmap_ids_names_dict.keys()
    ]
    same_lineage_values = entity_full_row_of_values[
        entity_full_row_of_values.index.isin(same_lineage_ids)
    ]
    same_lineage_values.dropna(inplace=True)
    same_lineage_values_by_display_name = same_lineage_values.rename(
        index=lineage_depmap_ids_names_dict
    )

    box_plot_data.append(
        {
            "type": BoxPlotTypes.SameLineage.value,
            "data": same_lineage_values_by_display_name.tolist(),
            "cell_line_display_names": same_lineage_values_by_display_name.index.tolist(),
        }
    )

    lineage_type_box_plot_data = _get_lineage_type_box_plot_data(
        top_context=top_context, entity_full_row_of_values=entity_full_row_of_values
    )

    return box_plot_data + lineage_type_box_plot_data


def has_gene_dep_data(cirspr_depmap_ids: List[str], context_depmap_ids: List[str]):
    intersection = list(set(context_depmap_ids).intersection(set(cirspr_depmap_ids)))

    return len(intersection) >= 5


def has_drug_data(drug_depmap_ids: List[str], context_depmap_ids: List[str]):
    intersection = list(set(context_depmap_ids).intersection(set(drug_depmap_ids)))

    return len(intersection) >= 5


def get_curve_params_for_model_ids(
    compound_experiment: CompoundExperiment, model_ids: List[str]
):
    curve_objs = DoseResponseCurve.get_curve_params(
        compound_experiment=compound_experiment, model_ids=model_ids
    )
    curve_params = []
    for curve in curve_objs:
        if curve is not None:
            curve_param = {
                "id": curve.depmap_id,
                "ec50": curve.ec50,
                "slope": curve.slope,
                "lowerAsymptote": curve.lower_asymptote,
                "upperAsymptote": curve.upper_asymptote,
            }
            curve_params.append(curve_param)

    return curve_params


def get_dose_response_curves_per_model(
    in_group_model_ids: List[str],
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
        model_ids=in_group_model_ids, compound_experiment=compound_experiment
    )

    out_group_curve_params = get_curve_params_for_model_ids(
        model_ids=out_group_model_ids, compound_experiment=compound_experiment
    )

    return {
        "in_group_curve_params": in_group_curve_params,
        "out_group_curve_params": out_group_curve_params,
        "max_dose": compound_dose_replicates[0].max_dose,
        "min_dose": compound_dose_replicates[0].min_dose,
    }


def get_out_group_model_ids(
    out_group_type, dataset_name, entity_id, in_group_model_ids
):
    (entity_full_row_of_values) = get_full_row_of_values_and_depmap_ids(
        dataset_id=dataset_name, entity_id=entity_id,
    )
    entity_full_row_of_values.dropna(inplace=True)
    if out_group_type == "All Others":
        return entity_full_row_of_values[
            ~entity_full_row_of_values.index.isin(in_group_model_ids)
        ].index.tolist()
    else:
        raise NotImplementedError(
            "Need to implement logic for getting model ids for none 'All Others' outgroup types"
        )
