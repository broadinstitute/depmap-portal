from itertools import groupby
import math
import os
import tempfile
from typing import Any, List, Optional
import zipfile
from depmap.compound import legacy_utils
from depmap.compound.utils import (
    get_compound_dataset_with_name_and_priority,
    dataset_exists_with_compound_in_auc_and_rep_datasets,
)
import requests
import urllib.parse

import numpy as np
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
from depmap.data_access.models import MatrixDataset
from depmap.cell_line.models_new import DepmapModel
from depmap.compound.models import (
    Compound,
    CompoundDoseReplicate,
    CompoundExperiment,
    DRCCompoundDatasetWithNamesAndPriority,
    DoseResponseCurve,
    drc_compound_datasets,
)
from depmap.compound.views.executive import (
    get_order,
    get_predictive_models_for_compound,
)
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.entity.views.index import format_celfie
from depmap.enums import DependencyEnum
from depmap.partials.matrix.models import ColMatrixIndex
from depmap.predictability.models import PredictiveFeatureResult, PredictiveModel
from depmap.predictability.utilities import (
    get_predictability_input_files_downloads_link,
)
from depmap.settings.shared import DATASET_METADATA
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
    sensitivity_tab_compound_summary = get_sensitivity_tab_info(
        compound.entity_id, compound_datasets
    )
    has_celfie = current_app.config["ENABLED_FEATURES"].celfie and has_datasets
    if has_celfie:
        celfie_dataset_options = []
        for compound_experiment, dataset in compound_experiment_and_datasets:
            celfie_dataset_options.append(
                format_summary_option(
                    dataset,
                    compound_experiment,
                    "{} {}".format(compound_experiment.label, dataset.display_name),
                )
            )
        celfie = format_celfie(
            entity_label=name, dependency_datasets=celfie_dataset_options
        )

    dose_curve_options_new = format_dose_curve_options_new_tab_if_available(
        compound_label=compound.label, compound_id=compound.compound_id
    )
    heatmap_dataset_options = get_heatmap_options_new_tab_if_available(
        compound_label=compound.label, compound_id=compound.compound_id
    )

    # If there are no no valid dataset options, hide the heatmap tab and tile
    show_heatmap_tab = len(heatmap_dataset_options) > 0

    # TODO: Update when context explorer moves to using compounds instead of compound experiments
    show_enriched_lineages = legacy_utils.does_legacy_dataset_exist_with_compound_experiment(
        DependencyEnum.Prism_oncology_AUC.value, compound_experiment_and_datasets
    ) or legacy_utils.does_legacy_dataset_exist_with_compound_experiment(
        DependencyEnum.Rep_all_single_pt.value, compound_experiment_and_datasets
    )

    return render_template(
        "compounds/index.html",
        name=name,
        compound_id=compound.compound_id,
        title=name,
        compound_aliases=compound_aliases,
        summary=sensitivity_tab_compound_summary,
        about=format_about(compound),
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
        ),
        dose_curve_options=format_dose_curve_options(compound_experiment_and_datasets),
        # If len(dose_curve_options_new) is 0, hide the tab in the index.html
        dose_curve_options_new=dose_curve_options_new,
        heatmap_dataset_options=heatmap_dataset_options,
        has_celfie=has_celfie,
        celfie=celfie if has_celfie else None,
        compound_units=compound.units,
        show_heatmap_tab=show_heatmap_tab,
        show_enriched_lineages=show_enriched_lineages,
    )


def get_sensitivity_tab_info(
    compound_entity_id: int, compound_datasets: list[MatrixDataset]
) -> Optional[dict[str, Any]]:
    """Get a dictionary of values containing layout information for the sensitivity tab."""
    if len(compound_datasets) == 0:
        return None

    # Define the options that will appear in the datasets dropdown
    dataset_options = []
    for dataset in compound_datasets:
        dataset_summary = {
            "label": dataset.label,
            "id": dataset.id,
            "dataset": dataset.id,
            "entity": compound_entity_id,
        }
        dataset_options.append(dataset_summary)

    return {
        "figure": {"name": compound_entity_id},
        "summary_options": dataset_options,
        "show_auc_message": True,
        "size_biom_enum_name": None,
        "color": None,
    }


def format_summary_option(dataset, entity, label):
    option = {
        "label": label,
        "id": "{}_{}".format(
            dataset.name.name, entity.entity_id
        ),  # used for uniqueness
        "dataset": dataset.name.name,
        "entity": entity.entity_id,
    }
    return option


def format_dose_curve_options(compound_experiment_and_datasets):
    """
    Used for jinja rendering of the dose curve tab
    """
    dose_curve_options = []
    for compound_experiment, dataset in compound_experiment_and_datasets:
        # if has dose curve information
        if (
            dataset.get_dose_replicate_enum()
            and len(
                CompoundDoseReplicate.get_all_with_compound_experiment_id(
                    compound_experiment.entity_id
                )
            )
            > 0
        ):
            dose_curve_option = format_dose_curve_option(
                dataset,
                compound_experiment,
                "{} {}".format(compound_experiment.label, dataset.display_name),
            )
            dose_curve_options.append(dose_curve_option)
    return dose_curve_options


def format_dose_curve_option(dataset, compound_experiment, label):
    option = format_summary_option(dataset, compound_experiment, label)
    option.update(
        {
            "dose_replicate_dataset": dataset.get_dose_replicate_enum().name,
            "auc_dataset_display_name": dataset.display_name,
            "compound_label": compound_experiment.label,
            "compound_xref_full": compound_experiment.xref_full,
            "dose_replicate_level_yunits": DATASET_METADATA[
                dataset.get_dose_replicate_enum()
            ].units,
        }
    )

    return option


def format_dose_curve_options_new_tab_if_available(
    compound_label: str, compound_id: str
):
    """
    Used for jinja rendering of the dose curve tab
    """
    show_new_dose_curves_tab = current_app.config[
        "ENABLED_FEATURES"
    ].new_compound_page_tabs

    valid_options = []
    if show_new_dose_curves_tab:
        for drc_dataset in drc_compound_datasets:
            if dataset_exists_with_compound_in_auc_and_rep_datasets(
                drc_dataset=drc_dataset,
                compound_label=compound_label,
                compound_id=compound_id,
            ):
                # TODO: Take this check out once the legacy db old drug datasets are updated to use the processed taiga ids.
                if (
                    drc_dataset.auc_dataset_given_id == "Prism_oncology_AUC_collapsed"
                    or current_app.config[
                        "ENABLED_FEATURES"
                    ].show_all_new_dose_curve_and_heatmap_tab_datasets
                ):
                    complete_option = get_compound_dataset_with_name_and_priority(
                        drc_dataset
                    )
                    valid_options.append(complete_option)

    return valid_options


def get_heatmap_options_new_tab_if_available(
    compound_label: str, compound_id: str
) -> List[DRCCompoundDatasetWithNamesAndPriority]:
    show_heatmap_tab = current_app.config["ENABLED_FEATURES"].new_compound_page_tabs

    valid_options = []
    if show_heatmap_tab:
        for drc_dataset in drc_compound_datasets:
            # TODO: Theoretically, we could let the Heatmap load without the dose curve params, but this would involve some frontend changes.
            if dataset_exists_with_compound_in_auc_and_rep_datasets(
                drc_dataset=drc_dataset,
                compound_label=compound_label,
                compound_id=compound_id,
            ):
                # TODO: Take this check out once the legacy db old drug datasets are updated to use the processed taiga ids.
                if (
                    drc_dataset.auc_dataset_given_id == "Prism_oncology_AUC_collapsed"
                    or current_app.config[
                        "ENABLED_FEATURES"
                    ].show_all_new_dose_curve_and_heatmap_tab_datasets
                ):
                    complete_option = get_compound_dataset_with_name_and_priority(
                        drc_dataset
                    )
                    valid_options.append(complete_option)

    return valid_options


def is_url_valid(url):
    """Check if a URL is valid

    Args:
        url (string): URL to check

    Returns:
        Bool: True if the URL is valid, False otherwise
    """
    try:
        response = requests.head(url)
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        return False


def format_about(compound):
    targets = [
        {"label": gene.label, "url": url_for("gene.view_gene", gene_symbol=gene.label)}
        for gene in compound.target_gene
    ]

    if len(targets) == 0:
        targets = None
    first_brd_compound_experiment = CompoundExperiment.get_first_with_compound_xref_type(
        compound.entity_id, "BRD"
    )

    # Generate the structure URL
    structure_url = (
        "https://storage.googleapis.com/depmap-compound-images/{}.svg".format(
            urllib.parse.quote(
                compound.smiles
            )  # Encode a compound SMILES string such as
            # "CN(C)C/C=C/C(=O)Nc1cc2c(Nc3ccc(F)c(Cl)c3)ncnc2cc1O[C@H]1CCOC1" to
            # "CN%28C%29C/C%3DC/C%28%3DO%29Nc1cc2c%28Nc3ccc%28F%29c%28Cl%29c3%29ncnc2cc1O%5BC%40H%5D1CCOC1"
        )
        if first_brd_compound_experiment
        else None
    )

    # Validate the structure URL
    if structure_url and not is_url_valid(structure_url):
        structure_url = None

    # Generate the ChEMBL URL
    chembl_id = compound.chembl_id
    chembl_url = (
        f"https://www.ebi.ac.uk/chembl/compound_report_card/{chembl_id}"
        if chembl_id
        else None
    )

    about = {
        "structure_url": structure_url,
        "target_or_mechanism": compound.target_or_mechanism,
        "targets": targets,
        "label": compound.label,
        "chembl_id": chembl_id,
        "chembl_url": chembl_url,
    }

    if all([value == None or value == "" for key, value in about.items()]):
        return None  # easier for html template to test
    else:
        return about


@blueprint.route("/compoundUrlRoot")
def get_compound_url_route():
    return jsonify(url_for("compound.view_compound", name=""))


# for testing:  http://127.0.0.1:5000/depmap-xqa/compound/dosecurve/CTRP_dose_replicate/ACH-000425/CTRP:1788
@blueprint.route("/dosecurve/<dataset_name>/<depmap_id>/<compound_label>")
def fetch_dose_curve(dataset_name, depmap_id, compound_label):
    dose_response_curve = format_dose_curve(dataset_name, depmap_id, compound_label)
    return jsonify(dose_response_curve)


def format_dose_curve(dataset_name, depmap_id, xref_full):
    # first, fetch the points of the dose response curve
    # use dataset_name to get the Dataset by name
    dataset = Dataset.get_dataset_by_name(dataset_name)
    assert dataset

    # get matrix associated with the dataset
    matrix = dataset.matrix

    cell_line = DepmapModel.get_by_model_id(depmap_id)

    # use xref_full to get the appropriate CompoundExperiment
    compound_experiment = CompoundExperiment.get_by_xref_full(xref_full)

    # get all CompoundDoseReplicate objects associated with CompoundExperiment
    compound_dose_replicates = CompoundDoseReplicate.get_all_with_compound_experiment_id(
        compound_experiment.entity_id
    )
    compound_dose_replicates = [
        dose_rep
        for dose_rep in compound_dose_replicates
        if DependencyDataset.has_entity(dataset.name, dose_rep.entity_id)
    ]

    # call the get_values_by_entities_and_depmap_id function in matrix, passing in entities and depmap id
    viabilities = matrix.get_values_by_entities_and_depmap_id(
        entities=compound_dose_replicates, depmap_id=cell_line.depmap_id
    )

    # points only contains viability -- we need to add on dose, isMasked, and replicate ourselves
    assert len(compound_dose_replicates) == len(viabilities)
    points = []
    for i in range(len(viabilities)):
        if (viabilities[i] is not None) & (not math.isnan(viabilities[i])):
            points.append(
                {
                    "dose": compound_dose_replicates[i].dose,
                    "viability": viabilities[i].item(),
                    "isMasked": compound_dose_replicates[i].is_masked,
                    "replicate": compound_dose_replicates[i].replicate,
                }
            )

    # fetch the dose response curve parameters using cell line name and compound experiment to find the appropriate DoseResponseCurve
    curve_objs = DoseResponseCurve.query.filter(
        DoseResponseCurve.compound_exp == compound_experiment,
        DoseResponseCurve.cell_line == cell_line,
    ).all()

    curve_params = []

    for curve in curve_objs:
        curve_param = {
            "ec50": curve.ec50,
            "slope": curve.slope,
            "lowerAsymptote": curve.lower_asymptote,
            "upperAsymptote": curve.upper_asymptote,
        }
        curve_params.append(curve_param)

    dose_response_curve = {"points": points, "curve_params": curve_params}

    return dose_response_curve


@blueprint.route("/dosetable/<dataset_name>/<xref_full>")
def dose_table(dataset_name, xref_full):
    """
    Return table of dose responses for different doses by cell line, plus depmap id
    and display name for the cell lines.
    :param dataset_name: enum name for the dose replicate dataset
    :return: a json structure like
        {
           "ACH-000552":{
              "0-0045":0.9473772049, # "0-0045" refers to the dose but with "." replaced with "-". This thus corresponds to 0.0045
              "0-29":0.8894940615,
              "2-3":0.68013376,
              "9-2":0.1122418195,
              "cell_line_display_name":"HT29",
              "auc":0.8729583436,
           },
           "ACH-000279":{
              ...
    """
    # first, fetch the points of the dose response curve
    # use dataset_name to get the Dataset by name
    dataset = Dataset.get_dataset_by_name(dataset_name, must=True)

    # get matrix associated with the dataset
    matrix = dataset.matrix

    # use xref_full to get the appropriate CompoundExperiment
    compound_experiment = CompoundExperiment.get_by_xref_full(xref_full)

    # get all CompoundDoseReplicate objects associated with CompoundExperiment
    compound_dose_replicates = CompoundDoseReplicate.get_all_with_compound_experiment_id(
        compound_experiment.entity_id
    )
    compound_dose_replicates = [
        dose_rep
        for dose_rep in compound_dose_replicates
        if DependencyDataset.has_entity(dataset.name, dose_rep.entity_id)
    ]

    matrix_col_index: List[ColMatrixIndex] = matrix.col_index.order_by(
        ColMatrixIndex.index
    ).all()
    # We need to filter out cols that exist in the underlying HDF5 file, but that were
    # not loaded as ColMatrixIndexes
    table_indices = [ci.index for ci in matrix_col_index]

    table = np.array(
        [matrix.get_values_by_entity(cpr.entity_id) for cpr in compound_dose_replicates]
    )

    df = pd.DataFrame(
        table[:, table_indices], columns=[ci.depmap_id for ci in matrix_col_index]
    )

    # The React component BaseTable has issues with periods in column names
    # "{:.15f}".format(cpr.dose) to fix UI bug caused by scientific notation. 5e-05 was being
    # parsed to 5μM instead of 0.000050 μM
    df["dose"] = [
        str("{:.15f}".format(cpr.dose)).replace(".", "-")
        for cpr in compound_dose_replicates
    ]

    if len(df) > 0:
        df = df.groupby("dose").mean()

    df = df.T

    cell_line_names = DepmapModel.get_cell_line_display_names(df.index)

    df = df.merge(cell_line_names, left_index=True, right_index=True)

    #### AUC
    auc_data = get_auc_data(dataset_name, compound_experiment)

    if auc_data is not None:
        df = df.merge(auc_data, left_index=True, right_index=True, how="left")

    df = df.T
    return df.to_json()


def get_auc_data(dataset_name, compound_experiment):
    dataset_to_auc = {
        DependencyEnum.GDSC1_dose_replicate.name: DependencyEnum.GDSC1_AUC,
        DependencyEnum.GDSC2_dose_replicate.name: DependencyEnum.GDSC2_AUC,
        DependencyEnum.Repurposing_secondary_dose_replicate.name: DependencyEnum.Repurposing_secondary_AUC,
        DependencyEnum.CTRP_dose_replicate.name: DependencyEnum.CTRP_AUC,
        DependencyEnum.Prism_oncology_dose_replicate.name: DependencyEnum.Prism_oncology_AUC,
    }
    if dataset_name in dataset_to_auc:
        auc_dataset_name = dataset_to_auc[dataset_name].name
        auc_dataset = Dataset.get_dataset_by_name(auc_dataset_name, must=True)
        auc_matrix = auc_dataset.matrix
        auc_data = auc_matrix.get_cell_line_values_and_depmap_ids(
            compound_experiment.entity_id
        )
        auc_data = pd.DataFrame.from_dict(
            auc_data.to_dict(), orient="index", columns=["auc"]
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
