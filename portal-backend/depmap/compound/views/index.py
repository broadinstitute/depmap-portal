from itertools import groupby
import os
import tempfile
from typing import List
import zipfile
from depmap.compound.utils import (
    get_compound_dataset_with_name_and_priority,
    dataset_exists_with_compound_in_auc_and_rep_datasets,
)

from depmap.context_explorer.models import ContextExplorerDatasets
from depmap.extensions import memoize_without_user_permissions
import pandas as pd
from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    url_for,
    send_file,
)

from depmap import data_access
from depmap.compound.models import (
    Compound,
    DRCCompoundDataset,
    DRCCompoundDatasetWithNamesAndPriority,
    drc_compound_datasets,
)
from depmap.compound.views.executive import (
    get_order,
    get_predictive_models_for_compound,
)
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.enums import DependencyEnum
from depmap.predictability.models import PredictiveFeatureResult, PredictiveModel
from depmap.predictability.utilities import (
    get_predictability_input_files_downloads_link,
)
from depmap.utilities.sign_bucket_url import get_signed_url

blueprint = Blueprint(
    "compound", __name__, url_prefix="/compound", static_folder="../static"
)


@memoize_without_user_permissions()
def _get_compound_page_template_parameters(name):
    compound = Compound.get_by_label(name, must=False)
    if compound is None:
        abort(404)

    aliases = Compound.get_aliases_by_entity_id(compound.entity_id)
    compound_aliases = ", ".join(
        [alias for alias in aliases if alias.lower() != name.lower()]
    )

    compound_experiment_and_datasets = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound.entity_id
    )
    has_predictability: bool = len(
        get_predictive_models_for_compound(compound_experiment_and_datasets)
    ) != 0

    # Figure out membership in different datasets
    compound_datasets = data_access.get_all_datasets_containing_compound(
        compound.compound_id
    )
    has_datasets = len(compound_datasets) != 0

    dose_curve_options_new = get_new_dose_curves_tab_drc_options(
        compound_label=compound.label, compound_id=compound.compound_id
    )
    heatmap_dataset_options = get_heatmap_tab_drc_options(
        compound_label=compound.label, compound_id=compound.compound_id
    )

    corr_analysis_options = get_corr_analysis_options_if_available(
        compound_label=compound.label,
    )

    # If there are no no valid dataset options, hide the heatmap tab and tile
    show_heatmap_tab = len(heatmap_dataset_options) > 0

    # TODO: Update when context explorer moves to using compounds instead of compound experiments
    show_enriched_lineages = (
        data_access.dataset_exists(
            ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.name
        )
        and data_access.valid_row(
            ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix.name,
            compound.label,
        )
        or data_access.dataset_exists(
            ContextExplorerDatasets.Rep_all_single_pt_per_compound.name
        )
        and data_access.valid_row(
            ContextExplorerDatasets.Rep_all_single_pt_per_compound.name, compound.label
        )
    )

    show_compound_correlated_dependencies_tile = current_app.config[
        "ENABLED_FEATURES"
    ].compound_correlated_dependencies_tile

    show_related_compounds_tile = current_app.config[
        "ENABLED_FEATURES"
    ].related_compounds_tile

    show_correlation_analysis = current_app.config[
        "ENABLED_FEATURES"
    ].correlation_analysis

    template_parameters = dict(
        name=name,
        compound_id=compound.compound_id,
        compound_aliases=compound_aliases,
        has_predictability=has_predictability,
        predictability_custom_downloads_link=get_predictability_input_files_downloads_link(),
        predictability_methodology_link=get_signed_url(
            "shared-portal-files", "Tools/Predictability_methodology.pdf"
        ),
        has_datasets=has_datasets,
        order=get_order(
            has_predictability,
            has_heatmap=show_heatmap_tab,
            show_enriched_lineages=show_enriched_lineages,
            show_compound_correlated_dependencies_tile=show_compound_correlated_dependencies_tile,
            show_related_compounds_tile=show_related_compounds_tile,
        ),
        # If len(dose_curve_options_new) is 0, hide the tab in the index.html
        dose_curve_options_new=dose_curve_options_new,
        corr_analysis_options=corr_analysis_options,
        heatmap_dataset_options=heatmap_dataset_options,
        compound_units=compound.units,
        show_heatmap_tab=show_heatmap_tab,
        show_enriched_lineages=show_enriched_lineages,
        show_correlation_analysis=show_correlation_analysis,
        show_compound_correlated_dependencies_tile=show_compound_correlated_dependencies_tile,
        show_related_compounds_tile=show_related_compounds_tile,
    )
    return template_parameters


# we use path: to be able to capture compound names such as VNLG/124 and
# erlotinib:PLX-4032 (2:1 mol/mol) which have slashes and colons. in most normal cases
# (e.g. more sane gene names), we don't want to do this.
@blueprint.route("/<path:name>")
def view_compound(name):
    # fetching these can be safely cached
    template_parameters = _get_compound_page_template_parameters(name)

    # but this template has a call to is_mobile which cannot safely be cached
    return render_template("compounds/index.html", **template_parameters)


def get_heatmap_tab_drc_options(
    compound_label: str, compound_id: str
) -> List[DRCCompoundDatasetWithNamesAndPriority]:
    """
    Used for jinja rendering of heatmap tab
    """
    show_heatmap_tab = current_app.config["ENABLED_FEATURES"].heatmap_tab

    valid_options = []
    if show_heatmap_tab:
        for drc_dataset in drc_compound_datasets:
            if dataset_exists_with_compound_in_auc_and_rep_datasets(
                drc_dataset=drc_dataset,
                compound_label=compound_label,
                compound_id=compound_id,
            ):
                complete_option = get_compound_dataset_with_name_and_priority(
                    drc_dataset
                )
                valid_options.append(complete_option)

    return valid_options


def get_new_dose_curves_tab_drc_options(
    compound_label: str, compound_id: str
) -> List[DRCCompoundDatasetWithNamesAndPriority]:
    """
    Used for jinja rendering of the dose curve tab
    """
    show_new_dose_curves_tab = current_app.config[
        "ENABLED_FEATURES"
    ].new_dose_curves_tab

    valid_options = []
    if show_new_dose_curves_tab:
        for drc_dataset in drc_compound_datasets:
            if dataset_exists_with_compound_in_auc_and_rep_datasets(
                drc_dataset=drc_dataset,
                compound_label=compound_label,
                compound_id=compound_id,
            ):
                complete_option = get_compound_dataset_with_name_and_priority(
                    drc_dataset
                )
                valid_options.append(complete_option)

    return valid_options


def get_corr_analysis_options_if_available(
    compound_label: str,
) -> List[DRCCompoundDataset]:
    show_corr_analysis = current_app.config["ENABLED_FEATURES"].correlation_analysis

    valid_options = []
    if show_corr_analysis:
        for drc_dataset in drc_compound_datasets:
            if drc_dataset.log_auc_dataset_given_id is not None:

                does_dataset_exist_with_compound = data_access.dataset_exists(
                    drc_dataset.log_auc_dataset_given_id
                ) and data_access.valid_row(
                    drc_dataset.log_auc_dataset_given_id, compound_label
                )

                if does_dataset_exist_with_compound:
                    complete_option = get_compound_dataset_with_name_and_priority(
                        drc_dataset, use_logged_auc=True
                    )
                    valid_options.append(complete_option)

    return valid_options


@blueprint.route("/compoundUrlRoot")
def get_compound_url_route():
    return jsonify(url_for("compound.view_compound", name=""))


def get_auc_data(dataset_name, compound_experiment):
    dataset_to_auc = {
        DependencyEnum(x.replicate_dataset).name: x.auc_dataset
        for x in drc_compound_datasets
    }
    if dataset_name in dataset_to_auc:
        auc_dataset_name = dataset_to_auc[dataset_name].name
        auc_dataset = Dataset.get_dataset_by_name(auc_dataset_name, must=True)
        auc_matrix = auc_dataset.matrix
        auc_data = auc_matrix.get_cell_line_values_and_depmap_ids(
            compound_experiment.entity_id
        )
        auc_log_or_auc_col = auc_dataset.matrix.units

        auc_data = pd.DataFrame.from_dict(
            auc_data.to_dict(), orient="index", columns=[auc_log_or_auc_col]
        )
        auc_data.index.name = "depmap_id"
        return auc_data
    else:
        return None


@blueprint.route("/api/predictive")
def get_predictive_table():
    compound_label = request.args.get("compoundLabel")
    compound = Compound.get_by_label(compound_label)

    compound_experiment_and_datasets = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound.entity_id
    )
    sorted_compound_experiment_and_datasets = sorted(
        compound_experiment_and_datasets,
        key=lambda x: x[1].priority if x[1].priority else 999,
    )

    # Sorted by compound experiment ID then model label
    sorted_models_for_compound_experiments = get_predictive_models_for_compound(
        sorted_compound_experiment_and_datasets
    )

    models_grouped_by_compound_experiment_and_dataset = groupby(
        sorted_models_for_compound_experiments, key=lambda x: (x[0], x[1].dataset)
    )

    data = []
    for (
        (compound_experiment, dataset),
        ce_and_models,
    ) in models_grouped_by_compound_experiment_and_dataset:
        models_and_results = []
        for ce, model in ce_and_models:
            sorted_feature_results: List[PredictiveFeatureResult] = sorted(
                model.feature_results, key=lambda result: result.rank
            )
            results = []
            for feature_result in sorted_feature_results:
                related_type = feature_result.feature.get_relation_to_entity(
                    ce.entity_id
                )

                row = {
                    "featureName": feature_result.feature.feature_name,
                    "featureImportance": feature_result.importance,
                    "correlation": feature_result.feature.get_correlation_for_entity(
                        model.dataset, ce
                    ),
                    "featureType": feature_result.feature.feature_type,
                    "relatedType": related_type,
                    "interactiveUrl": feature_result.feature.get_interactive_url_for_entity(
                        model.dataset, ce
                    ),
                }
                results.append(row)

            # Hack to rename these without needing to change pipeline/db
            model_label = {
                "Core_omics": "Core Omics",
                "Extended_omics": "Extended Omics",
                "DNA_based": "DNA-based",
            }[model.label]

            row = {
                "compoundExperimentId": ce.xref_full,
                "modelCorrelation": model.pearson,
                "results": results,
                "modelName": model_label,
            }
            models_and_results.append(row)
        data.append(
            {
                "screen": dataset.display_name,
                "compoundExperimentId": compound_experiment.xref_full,
                "modelsAndResults": models_and_results,
            }
        )
    return jsonify(data)


@blueprint.route("/predictability_files")
def get_predictability_files():
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    predictability_path = os.path.join(source_dir, "predictability")
    # Find all predictive models for drug screen datasets which have compounds or compound experiments as features and get the dataset enum
    # Note: It seems predictive models have relationship with DependencyDataset and are usually compound experiments features?
    drug_screen_enums_with_predictabilities = (
        PredictiveModel.query.filter(
            PredictiveModel.dataset.has(data_type="drug_screen")
        )
        .join(DependencyDataset)
        .with_entities(DependencyDataset.name)
        .distinct()
        .all()
    )

    write_path = os.path.join(
        source_dir, "predictability", "compound_predictability_results.zip",
    )
    if not os.path.exists(write_path):
        # Write zipfile to temporary directory. This should prevent zip file from getting messed up from concurrent calls to this function
        with tempfile.NamedTemporaryFile(
            delete=False, dir=os.path.dirname(os.path.abspath(predictability_path))
        ) as tmpfile:
            with zipfile.ZipFile(tmpfile, "w") as zf:
                for (enum,) in drug_screen_enums_with_predictabilities:
                    zf.write(
                        os.path.join(
                            predictability_path,
                            f"{enum.name}_predictability_results.csv",
                        ),
                        arcname=f"{enum.name}_predictability_results.csv",
                    )
                zf.close()
                # Move zip file in tmpdir to predictabilty results path
                os.rename(
                    tmpfile.name, write_path
                )  # this overwrites the destination if exists bc should be atomic on unix systems

    return send_file(write_path, mimetype="application/zip", as_attachment=True)


@blueprint.route("/<path:compound_name>/genomic_associations")
def view_genomic_associations(compound_name: str):
    # This is broken and being replaced
    return render_template("entities/celfie_page.html", celfie=None)
