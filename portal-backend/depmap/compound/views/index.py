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


# we use path: to be able to capture compound names such as VNLG/124 and
# erlotinib:PLX-4032 (2:1 mol/mol) which have slashes and colons. in most normal cases
# (e.g. more sane gene names), we don't want to do this.
@blueprint.route("/<path:name>")
def view_compound(name):
    compound = Compound.get_by_label(name, must=False)
    if compound is None:
        abort(404)

    aliases = Compound.get_aliases_by_entity_id(compound.entity_id)
    compound_aliases = ", ".join(
        [alias for alias in aliases if alias.lower() != name.lower()]
    )

    # Figure out membership in different datasets
    compound_datasets = data_access.get_all_datasets_containing_compound(
        compound.compound_id
    )
    has_datasets = len(compound_datasets) != 0

    dataset_given_ids = [d.given_id for d in compound_datasets]
    has_predictability: bool = has_datasets and len(
        get_predictive_models_for_compound(
            dataset_given_ids=dataset_given_ids, feature_id=compound.compound_id
        )
    ) != 0

    heatmap_dataset_options = get_heatmap_dose_curves_tab_drc_options(
        compound_label=compound.label, compound_id=compound.compound_id
    )

    # If there are no no valid dataset options, hide the heatmap tab and tile
    show_heatmap_tab = len(heatmap_dataset_options) > 0

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

    return render_template(
        "compounds/index.html",
        name=name,
        compound_id=compound.compound_id,
        title=name,
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
        compound_units=compound.units,
    )


def get_heatmap_dose_curves_tab_drc_options(
    compound_label: str, compound_id: str
) -> List[DRCCompoundDatasetWithNamesAndPriority]:
    valid_options = []

    for drc_dataset in drc_compound_datasets:
        if dataset_exists_with_compound_in_auc_and_rep_datasets(
            drc_dataset=drc_dataset,
            compound_label=compound_label,
            compound_id=compound_id,
        ):
            complete_option = get_compound_dataset_with_name_and_priority(drc_dataset)
            valid_options.append(complete_option)

    return valid_options


def get_corr_analysis_options(compound_label: str,) -> List[DRCCompoundDataset]:
    valid_options = []

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


@blueprint.route("/api/predictive")
def get_predictive_table():
    compound_label = request.args.get("compoundLabel")
    compound = Compound.get_by_label(compound_label)

    compound_and_datasets = data_access.get_all_datasets_containing_compound(
        compound.compound_id
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
