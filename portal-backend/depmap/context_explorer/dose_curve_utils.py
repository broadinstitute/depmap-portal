from typing import List
from depmap.cell_line.models_new import DepmapModel
from depmap.compound import new_dose_curves_utils
from depmap.context_explorer.models import ContextExplorerDatasets
import pandas as pd
from depmap.context_explorer import utils
from depmap.context.models_new import SubtypeNode, SubtypeContext
from depmap.dataset.models import Dataset
from depmap.compound.models import Compound, drc_compound_datasets


def _get_out_group_model_ids(
    out_group_type, dataset_given_id, in_group_model_ids, feature_id, tree_type
):
    (entity_full_row_of_values) = utils.get_full_row_of_values_and_depmap_ids(
        dataset_given_id=dataset_given_id, feature_id=feature_id
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
                [], tree_type, in_group_model_ids
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
    dataset_given_id: str,
    feature_id: str,
    subtype_code: str,
    level: int,
    out_group_type: str,
    tree_type: str,
):
    in_group_model_ids = SubtypeNode.get_model_ids_by_subtype_code_and_node_level(
        subtype_code, level
    )

    out_group_model_ids = _get_out_group_model_ids(
        out_group_type,
        dataset_given_id=dataset_given_id,
        in_group_model_ids=in_group_model_ids,
        feature_id=feature_id,
        tree_type=tree_type,
    )

    return {
        "in_group_model_ids": in_group_model_ids,
        "out_group_model_ids": out_group_model_ids,
    }


def _get_dose_response_curves_per_model(
    drc_dataset_label: str,
    in_group_model_ids: List[str],
    out_group_model_ids: List[str],
    replicate_dataset_name: str,
    compound: Compound,
):
    dataset = Dataset.get_dataset_by_name(replicate_dataset_name)

    assert dataset is not None

    compound_dose_replicates = new_dose_curves_utils.get_compound_dose_replicates(
        compound_id=compound.compound_id,
        drc_dataset_label=drc_dataset_label,
        replicate_dataset_name=replicate_dataset_name,
    )
    doses = [cdr.dose for cdr in compound_dose_replicates]
    min_dose = min(doses)
    max_dose = max(doses)
    in_group_model_display_names = DepmapModel.get_cell_line_display_names(
        list(set(in_group_model_ids))
    )

    in_group_curve_params = get_curve_params_for_model_ids(
        model_ids=in_group_model_ids,
        model_display_names_by_model_id=in_group_model_display_names,
        compound=compound,
    )

    out_group_model_display_names = DepmapModel.get_cell_line_display_names(
        list(set(out_group_model_ids))
    )
    out_group_curve_params = get_curve_params_for_model_ids(
        model_ids=out_group_model_ids,
        model_display_names_by_model_id=out_group_model_display_names,
        compound=compound,
    )

    return {
        "in_group_curve_params": in_group_curve_params,
        "out_group_curve_params": out_group_curve_params,
        "max_dose": max_dose,
        "min_dose": min_dose,
    }


def get_curve_params_for_model_ids(
    compound: Compound,
    model_ids: List[str],
    model_display_names_by_model_id: pd.Series,
):
    # Use drc_dataset_label to get the dose response curves for the dataset selected in the UI. This is necessary
    # because dose response curves have a relationship with CompoundExperiment, not Compound, and 1 compound can have
    # multiple compound experiments mapping to different datasets and therefore different sets of dose response curves.

    # TODO Remove temporary hard coding of drc_dataset_label once we add support for more OncRef datasets in Context Explorer.
    curve_objs = Compound.get_dose_response_curves(
        compound_id=compound.compound_id,
        drc_dataset_label="Prism_oncology_per_curve",
        model_ids=model_ids,
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
    dataset_given_id: str,
    feature_id: str,
    subtype_code: str,
    level: int,
    out_group_type: str,
    tree_type: str,
):

    assert dataset_given_id == ContextExplorerDatasets.Prism_oncology_AUC_collapsed.name

    drc_dataset = utils.find_compound_dataset(
        datasets=drc_compound_datasets,
        key_name="auc_dataset_given_id",
        value_name=dataset_given_id,
    )
    replicate_dataset_id = drc_dataset.replicate_dataset

    replicate_dataset_name = replicate_dataset_id
    compound = Compound.get_by_compound_id(feature_id)

    in_group_out_group_model_ids = _get_in_group_out_group_model_ids(
        dataset_given_id=dataset_given_id,
        feature_id=feature_id,
        subtype_code=subtype_code,
        level=level,
        out_group_type=out_group_type,
        tree_type=tree_type,
    )

    dose_curve_info = _get_dose_response_curves_per_model(
        drc_dataset_label=drc_dataset.drc_dataset_label,
        in_group_model_ids=in_group_out_group_model_ids["in_group_model_ids"],
        out_group_model_ids=in_group_out_group_model_ids["out_group_model_ids"],
        replicate_dataset_name=replicate_dataset_name,
        compound=compound,
    )

    return {
        "compound": compound,
        "replicate_dataset_name": replicate_dataset_name,
        "dose_curve_info": dose_curve_info,
    }
