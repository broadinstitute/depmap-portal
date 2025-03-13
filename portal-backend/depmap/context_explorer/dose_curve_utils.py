from typing import Dict, List
from depmap.cell_line.models_new import DepmapModel
from depmap.partials.matrix.models import CellLineSeries
import pandas as pd
from depmap.context_explorer import utils
from depmap.context.models_new import SubtypeNode, SubtypeContext
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.compound.models import (
    CompoundExperiment,
    CompoundDoseReplicate,
    DoseResponseCurve,
)


def _get_out_group_model_ids(out_group_type, dataset_name, in_group_model_ids, label):
    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_name=dataset_name, label=label
    )
    entity_full_row_of_values.dropna(inplace=True)
    entity_full_row_of_values = pd.DataFrame(entity_full_row_of_values)

    if out_group_type == "All Others":
        return entity_full_row_of_values[
            ~entity_full_row_of_values.index.isin(in_group_model_ids)
        ].index.tolist()
    else:
        # Get list of model ids for out_group_type which will be the subtype_code of the out group
        # or "All Others" or "Other Heme".
        # TODO: out_group_type as named is super confusing. Make it easier to figure out this could be
        # a subtype code
        if out_group_type == "Other Heme":
            # find the Heme model ids
            other_heme_model_ids = SubtypeContext.get_model_ids_for_other_heme_contexts(
                in_group_model_ids
            )
            return list(other_heme_model_ids.keys())
        else:
            # The outgroup better be a subtype code. This will be a parent of the selected
            # code. So we need to subtract the in group model ids from the out group ids
            node = SubtypeNode.get_by_code(out_group_type)
            assert node is not None
            all_node_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
                subtype_code=out_group_type, node_level=node.node_level
            )
            out_group_model_ids = list(
                set(all_node_model_ids) - set(in_group_model_ids)
            )

            return out_group_model_ids


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


def _get_dose_response_curves_per_model(
    in_group_model_ids: List[str],
    out_group_model_ids: List[str],
    replicate_dataset_name: str,
    compound_experiment: CompoundExperiment,
):
    dataset = Dataset.get_dataset_by_name(replicate_dataset_name)

    dose_min_max_df = CompoundDoseReplicate.get_dose_min_max_of_replicates_with_compound_experiment_id(
        compound_experiment.entity_id
    )
    assert dataset is not None
    compound_dose_replicates = [
        dose_rep
        for dose_rep in dose_min_max_df
        if DependencyDataset.has_entity(dataset.name, dose_rep.entity_id)
    ]

    in_group_model_display_names = DepmapModel.get_cell_line_display_names(
        list(set(in_group_model_ids))
    )

    in_group_curve_params = get_curve_params_for_model_ids(
        model_ids=in_group_model_ids,
        model_display_names_by_model_id=in_group_model_display_names,
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


def get_context_dose_curves(
    dataset_name: str,
    entity_full_label: str,
    subtype_code: str,
    level: int,
    out_group_type: str,
):
    assert dataset_name == DependencyDataset.DependencyEnum.Prism_oncology_AUC.name
    dataset = DependencyDataset.get_dataset_by_name(dataset_name)
    assert dataset is not None
    replicate_dataset = dataset.get_dose_replicate_enum()
    assert replicate_dataset is not None
    replicate_dataset_name = replicate_dataset.name
    compound_experiment = utils.get_compound_experiment(
        entity_full_label=entity_full_label
    )

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
