import json
from typing import Any, Dict, List
from depmap.enums import DataTypeEnum, TabularEnum
from depmap.oncokb_version.models import OncokbDatasetVersionDate
from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
    make_response,
)
import numpy as np
import pandas as pd
import sqlalchemy as sa

from depmap import data_access
from depmap.partials.matrix.models import ColMatrixIndex
from oauth2client.service_account import ServiceAccountCredentials

from depmap.dataset.models import (
    Compound,
    CompoundExperiment,
    DependencyDataset,
    BiomarkerDataset,
    TabularDataset,
)
from depmap.cell_line.models_new import DepmapModel
from depmap.download.models import ExternalBucketUrl
from depmap.download.utils import get_download_url
from depmap.extensions import csrf_protect
from depmap.metmap.models import MetMap500
from depmap.utilities.sign_bucket_url import sign_url
from depmap.partials.matrix.models import Matrix, RowMatrixIndex
from depmap.partials.data_table.factories import (
    get_mutation_by_cell_line_table,
    get_fusion_by_cell_line_table,
    get_translocation_by_cell_line_table,
)
from depmap.partials.data_table.models import DataTable

blueprint = Blueprint(
    "cell_line", __name__, url_prefix="/cell_line", static_folder="../static"
)


@blueprint.route("/v2/")
def view_cell_line_v2():
    return redirect("../")


@blueprint.route("/validate", methods=["POST"])
@csrf_protect.exempt  # we don't have accounts or anything - people can validate all the cell lines they want
def validate_cell_lines():
    """
    Duplicates get silently ignored
    List order is messed up
    :return:
    """
    cell_lines = json.loads(request.form.get("cell_lines"))

    valid_cell_lines = DepmapModel.get_valid_cell_line_names_in(cell_lines)
    invalid_cell_lines = set(cell_lines) - valid_cell_lines

    response = {
        "validCellLines": list(valid_cell_lines),
        "invalidCellLines": list(invalid_cell_lines),
    }
    return jsonify(response)


@blueprint.route("/<cell_line_name>")
def view_cell_line(cell_line_name):
    # first try to look up cell line by model_id a.k.a. depmap id (arxspan) and fall back to CCLE name if no match. This allows
    # external links in (now specifically, from Sanger's Cell Line Portal) to use an identifier which is more
    # stable then CCLE name.
    selected_cell_line = DepmapModel.get_by_model_id(cell_line_name, must=False)

    if selected_cell_line is None:
        selected_cell_line = DepmapModel.get_by_name(cell_line_name=cell_line_name)

    if selected_cell_line is None:
        selected_cell_line = DepmapModel.get_by_ccle_name(ccle_name=cell_line_name)

    if selected_cell_line is None:
        abort(404)

    has_metmap_data = MetMap500.has_cell_line(selected_cell_line.model_id)

    return render_template(
        "cell_lines/cell_line.html",
        stripped_cell_line_name=selected_cell_line.stripped_cell_line_name,
        public_comments=selected_cell_line.public_comments,
        model_id=selected_cell_line.model_id,
        has_metmap_data=has_metmap_data,
    )


def get_image_url(image_filename):
    url = ""
    if image_filename:
        image_list = image_filename.split(",")
        if len(image_list) == 1:
            file_name = "cell_line_photos/" + image_list[0]
            credentials = ServiceAccountCredentials.from_json_keyfile_name(
                current_app.config["DOWNLOADS_KEY"]
            )
            url = sign_url(credentials, ExternalBucketUrl.BUCKET, file_name)
    return url


def get_related_models(patient_id: str, model_id: str) -> List[Dict[str, str]]:
    related_models = DepmapModel.get_related_models_by_patient_id(patient_id, model_id)

    related_models_info = []
    for model_id, _ in related_models:
        related_models_info.append(
            {
                "model_id": model_id,
                "url": url_for("cell_line.view_cell_line", cell_line_name=model_id),
            }
        )

    return related_models_info


@blueprint.route("/description_tile/<model_id>")
def get_cell_line_description_tile_data(model_id: str) -> dict:
    model = DepmapModel.get_by_model_id(model_id)

    if model is None:
        abort(404)
    assert model is not None

    image = get_image_url(model.image_filename)

    if model.level_1_lineage.name == "unknown":
        lineage = []
    else:
        lineages = sorted(model.oncotree_lineage, key=lambda x: x.level)
        lineage = [
            {
                "display_name": lineage.display_name,
                "url": url_for("context.view_context", context_name=lineage.name)
                if lineage.level < 5
                else None,  # NOTE: We cannot provide context link for lineage levels 5-6 since context matrix is only built from lineage levels 1-4. Temporary until we are able to include these lineage levels to our context matrix
            }
            for lineage in lineages
        ]

    oncotree_lineage = lineage[0] if len(lineage) >= 1 else None
    oncotree_primary_disease = lineage[1] if len(lineage) >= 2 else None
    oncotree_subtype = lineage[2] if len(lineage) >= 3 else None

    selected_cell_line = model.cell_line

    related_models = get_related_models(model.patient_id, model.model_id)

    model_info = {
        "image": image,
        "oncotree_lineage": oncotree_lineage,
        "oncotree_primary_disease": oncotree_primary_disease,
        "oncotree_subtype_and_code": {
            "display_name": f"{model.oncotree_subtype} ({model.oncotree_code})",
            "url": lineage[2]["url"],
        }
        if oncotree_subtype
        else None,
        "aliases": [
            ali.alias
            for ali in selected_cell_line.cell_line_alias
            if ali.alias
            != selected_cell_line.cell_line_name  # filter out ccle name, since already shown on the page
        ],
        "related_models": related_models,
        "metadata": json.loads(model.json_encoded_metadata),
    }

    return model_info


@blueprint.route("/prefdep/<data_type>/<model_id>")
def get_pref_dep_data_for_data_type(data_type: str, model_id: str) -> dict:
    dataset = DependencyDataset.get_dataset_by_data_type_priority(data_type)
    if dataset is None:
        abort(404)
    # dataset_name is dataset enum name
    dataset_name = dataset.name.name
    rows = get_rows_with_lowest_z_score(dataset_name, model_id)
    return rows


@blueprint.route("/compound_sensitivity/<model_id>")
def get_compound_sensitivity_data(model_id: str) -> dict:
    dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.drug_screen
    )
    if dataset is None:
        abort(404)
    dataset_name = dataset.name.name
    labels_by_exp_id = get_compound_labels_by_experiment_id(dataset_name)

    return get_rows_with_lowest_z_score(dataset_name, model_id, index_renaming_dict=labels_by_exp_id)


def get_rows_with_lowest_z_score(
    dataset_name: str, model_id: str, index_renaming_dict: dict[str, str] = {}
):
    """Gets data for the top 10 rows of the given dataset, where top values have the 
    lowest z-scores for the cell line (matching the given depmap id). For example, 
    this function can return the top preferentially dependent genes - those who's 
    cell line gene effects have the lowest z-score. 

    Returns: Top labels (ex. genes) and values (ex. gene effects) across all cell lines
    as well as index of the column containing data for the given cell line. 
    """
    cell_line = DepmapModel.get_by_model_id(model_id, must=False)
    result = {
        "model_id": cell_line.model_id,
        "dataset_label": data_access.get_dataset_label(dataset_name),
    }

    df = data_access.get_subsetted_df_by_labels(dataset_name)
    if index_renaming_dict:
        df = df.rename(index=index_renaming_dict) # TODO: run frontend to confirm this still works (no test for this)

    if model_id in df.columns:
        # Get the full matrix of gene effect dat        
        df = df[np.isfinite(df[model_id])]  # filter nulls
        # sort the matrix using cell line z-scores
        cell_line_z_scores = convert_to_z_score_matrix(df)[model_id]
        sorted_index = cell_line_z_scores.sort_values().index
        sorted_df = df.loc[sorted_index]
        result_df = sorted_df.head(10)  # return data for the top 10 genes
        # Construct result
        result["labels"] = result_df.index.values.tolist()
        result["data"] = result_df.replace({np.nan: None}).values.tolist()
        result["cell_line_col_index"] = result_df.columns.get_loc(model_id)
    return result


def convert_to_z_score_matrix(data_matrix: pd.DataFrame) -> pd.DataFrame:
    """For the given matrix, convert all values to z scores by calculating
    means and standard deviations across rows."""
    means = data_matrix.mean(axis=1)
    standard_devs = data_matrix.std(axis=1)
    z_scores = data_matrix.sub(means, axis=0).div(standard_devs, axis=0)
    return z_scores


def get_cell_line_col_index(dataset_name, model_id):
    ds = DependencyDataset.get_dataset_by_name(dataset_name)
    if ds is not None:
        cmi = ColMatrixIndex.query.filter_by(
            depmap_id=model_id, matrix_id=ds.matrix_id
        ).one_or_none()
        return cmi.index if cmi else None


@blueprint.route("/gene_effects/download/<dataset_type>/<model_id>")
def download_gene_effects(dataset_type: str, model_id: str):
    # Check that the requested cell line and dataset exist
    if dataset_type == "rnai":
        dataset_name = DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.rnai
        ).name.name
    elif dataset_type == "crispr":
        dataset_name = DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr
        ).name.name
    else:
        abort(404)

    all_model_ids = data_access.get_dataset_sample_ids(dataset_name)
    if model_id not in all_model_ids:
        abort(404)

    # Get the gene effect data that relates to this cell line
    df = get_all_cell_line_gene_effects(dataset_name, model_id)

    # return the dataframe as a CSV
    response = make_response(df.to_csv())
    response.headers[
        "Content-Disposition"
    ] = f"attachment; filename=gene_effects_{model_id}.csv"
    response.headers["Content-Type"] = "text/csv"
    return response


def get_all_cell_line_gene_effects(
    dataset_name: str, model_id: int
) -> pd.DataFrame:
    """Get all gene effect data related to the cell line. Include five columns:
        gene, gene_effect, z_score, mean, stddev"""
    gene_effect_df = data_access.get_subsetted_df_by_labels(dataset_name)
    gene_effect_df = gene_effect_df[np.isfinite(gene_effect_df[model_id])]

    result_df = get_stats_for_dataframe(gene_effect_df, model_id)

    result_df = result_df.rename(columns={"val": "gene_effect"})
    result_df.index.rename("gene", inplace=True)
    return result_df


@blueprint.route("/compound_sensitivity/download/<model_id>")
def download_compound_sensitivities(model_id: str):
    # Check that the requested cell line exists
    dataset_name = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.drug_screen
    ).name.name
    cell_line_col_index = get_cell_line_col_index(dataset_name, model_id)
    if cell_line_col_index is None:
        abort(404)

    # Get the gene effect data that relates to this cell line
    df = get_all_cell_line_compound_sensitivity(dataset_name, model_id)

    # return the dataframe as a CSV
    response = make_response(df.to_csv())
    response.headers[
        "Content-Disposition"
    ] = f"attachment; filename=compound_sensitivity_{model_id}.csv"
    response.headers["Content-Type"] = "text/csv"
    return response


def get_all_cell_line_compound_sensitivity(
    dataset_name: str, model_id: str
) -> pd.DataFrame:
    """Get all compound sensitivity data related to the cell line. Include five columns:
        compound, compound_sensitivity, z_score, mean, stddev"""
    sensitivity_df = data_access.get_subsetted_df_by_ids(dataset_name)
    sensitivity_df = sensitivity_df[np.isfinite(sensitivity_df[model_id])]

    # The dataframe is currently indexed by compound experiment. Re-index by compound.
    labels_by_exp_id = get_compound_labels_by_experiment_id(dataset_name)
    sensitivity_df = sensitivity_df.rename(index=labels_by_exp_id)

    result_df = get_stats_for_dataframe(sensitivity_df, model_id)

    result_df = result_df.rename(columns={"val": "compound_sensitivity"})
    result_df.index.rename("compound", inplace=True)
    return result_df


def get_stats_for_dataframe(df: pd.DataFrame, model_id: str):
    """Get the mean, stddev, and given cell line's value and z_score for each row in a matrix of numeric values.
    Sort the result by z-score."""
    means = df.mean(axis=1).rename("mean")
    standard_devs = df.std(axis=1).rename("stddev")
    cell_line_vals = df[model_id].rename("val")
    cell_line_z_scores = cell_line_vals.sub(means).div(standard_devs).rename("z_score")
    result_df = pd.concat(
        [cell_line_vals, cell_line_z_scores, means, standard_devs,], axis=1
    )
    # sort the result
    sorted_index = cell_line_z_scores.sort_values().index
    result_df = result_df.loc[sorted_index]
    return result_df


def get_compound_labels_by_experiment_id(dataset_name: str) -> dict[str, str]:
    """Compound labels by row matrix index."""
    # TODO: move this elsewhere to be replaced - or figure out if it already exists elsewhere
    # Data access details should be in interactive config
    # (Using SQLAlchemy to join the compound object to the matrix)
    matrix_id = data_access.get_matrix_id(dataset_name)
    comp_exp_alias = sa.orm.aliased(CompoundExperiment)
    compound_alias = sa.orm.aliased(Compound)
    labels_by_indeces = (
        Matrix.query.filter_by(matrix_id=matrix_id)
        .join(RowMatrixIndex)
        .join(comp_exp_alias)
        .join(compound_alias, compound_alias.entity_id == comp_exp_alias.compound_id)
        .with_entities(comp_exp_alias.label, compound_alias.label)
        .all()
    )
    return {experiment_id: compound_label for experiment_id, compound_label in labels_by_indeces}


@blueprint.route("/datasets/<model_id>")
def get_cell_line_datasets(model_id: str):
    tabular_to_datatype_mapping = {
        TabularEnum.mutation: DataTypeEnum.mutations,
        TabularEnum.fusion: DataTypeEnum.structural_variants,
        TabularEnum.translocation: DataTypeEnum.structural_variants,
        TabularEnum.metmap: DataTypeEnum.metmap,
    }

    enums = [
        BiomarkerDataset.BiomarkerEnum.expression,
        BiomarkerDataset.BiomarkerEnum.copy_number_relative,
        BiomarkerDataset.BiomarkerEnum.mutations_hotspot,
        BiomarkerDataset.BiomarkerEnum.mutations_damaging,
        BiomarkerDataset.BiomarkerEnum.mutations_driver,
        TabularDataset.TabularEnum.mutation,
        TabularDataset.TabularEnum.fusion,
        TabularDataset.TabularEnum.translocation,
        BiomarkerDataset.BiomarkerEnum.rppa,
        BiomarkerDataset.BiomarkerEnum.rrbs,
        BiomarkerDataset.BiomarkerEnum.copy_number_absolute,
        BiomarkerDataset.BiomarkerEnum.proteomics,
        BiomarkerDataset.BiomarkerEnum.sanger_proteomics,
        BiomarkerDataset.BiomarkerEnum.CRISPRGeneDependency,
        BiomarkerDataset.BiomarkerEnum.OmicsAbsoluteCNGene,
        BiomarkerDataset.BiomarkerEnum.OmicsLoH,
        BiomarkerDataset.BiomarkerEnum.OmicsSignatures,
    ]
    dependency_datasets = DependencyDataset.get_datasets_in_order()

    dataset_types: Dict[str, List[Dict[str, Any]]] = {
        datatype.value: []
        for datatype in DataTypeEnum
        if datatype.value != DataTypeEnum.deprecated.value
    }

    for dep in dependency_datasets:
        if DependencyDataset.has_cell_line(dep.name, model_id):
            dataset_display = {
                "display_name": dep.display_name,
                "download_url": get_download_url(dep.taiga_id),
            }
            dataset_types[dep.data_type.value].append(dataset_display)

    for enum in enums:
        if isinstance(enum, BiomarkerDataset.BiomarkerEnum):
            biomarker_dataset = BiomarkerDataset.get_dataset_by_name(
                enum.name, must=False
            )
            if biomarker_dataset is None:
                continue
            if BiomarkerDataset.has_cell_line(enum, model_id):
                dataset_display = {
                    "display_name": biomarker_dataset.display_name,
                    "download_url": get_download_url(biomarker_dataset.taiga_id),
                }
                dataset_types[biomarker_dataset.data_type.value].append(dataset_display)

        elif isinstance(enum, TabularDataset.TabularEnum):
            dataset = TabularDataset.get_by_name(enum, must=False)
            if dataset is None:
                continue
            if dataset.table_class.has_cell_line(model_id):
                dataset_display = {
                    "display_name": dataset.display_name,
                    "download_url": get_download_url(dataset.taiga_id),
                }
                data_type = tabular_to_datatype_mapping[enum].value

                dataset_types[data_type].append(dataset_display)

        else:
            raise ValueError("Unexpected enum {}".format(enum))

    return dataset_types


@blueprint.route("/oncogenic_alterations/<model_id>")
def get_cell_line_oncogenic_alterations(model_id: str):
    mutation_data_table: DataTable = get_mutation_by_cell_line_table(model_id)
    mutations = get_json_from_data_table(mutation_data_table)  # list of objects
    oncokb_dataset_version = OncokbDatasetVersionDate.query.with_entities(
        OncokbDatasetVersionDate.version
    ).scalar()

    onco_alterations = []
    for mutation in mutations:
        # if the mutation is oncogenic, append to the result list
        oncogenic_label = mutation.get("Oncogenic")
        if oncogenic_label == "Oncogenic" or oncogenic_label == "Likely Oncogenic":
            # Take the columns we need and replace gene names with hyperlinks
            protein_change = mutation.get("Protein Change")
            alteration = protein_change.replace("p.", "") if protein_change else None
            onco_alterations.append(
                {
                    "gene": get_gene_link(gene_name=mutation["Gene"]),
                    "alteration": alteration,
                    "oncogenic": oncogenic_label,
                    "function_change": mutation.get("Mutation Effect"),
                    "dataste": None,
                }
            )

    return {
        "onco_alterations": onco_alterations,
        "oncokb_dataset_version": oncokb_dataset_version,
    }


@blueprint.route("/mutations/<model_id>")
def get_mutation_data_by_cell_line(model_id):
    mutation_data_object: DataTable = get_mutation_by_cell_line_table(model_id)
    result_json_data = get_json_from_data_table(mutation_data_object)

    # Generating hyperlinks for genes and replacing gene names with the hyperlinks
    for item in result_json_data:
        item["Gene"] = get_gene_link(gene_name=item["Gene"])

    endpoint_dict = {
        "columns": mutation_data_object.renamed_cols,
        "data": result_json_data,
        "default_columns_to_show": mutation_data_object.default_cols_to_show,
        "download_url": mutation_data_object.data_for_ajax_partial_temp()[
            "download_url"
        ],
    }

    return endpoint_dict


@blueprint.route("/fusions/<model_id>")
def get_fusion_data_by_cell_line(model_id):
    fusion_data_object: DataTable = get_fusion_by_cell_line_table(model_id)
    result_json_data = get_json_from_data_table(fusion_data_object)

    # Generating hyperlinks for genes and replacing gene names with the hyperlinks
    for item in result_json_data:
        item["Left Gene"] = get_gene_link(gene_name=item["Left Gene"])
        item["Right Gene"] = get_gene_link(gene_name=item["Right Gene"])

        item["Annots"] = item["Annots"].strip("[]")
        item["Annots"] = item["Annots"].replace('"', "")
        item["Annots"] = item["Annots"].replace(",", "; ")

    endpoint_dict = {
        "columns": fusion_data_object.renamed_cols,
        "data": result_json_data,
        "default_columns_to_show": fusion_data_object.default_cols_to_show,
        "download_url": fusion_data_object.data_for_ajax_partial_temp()["download_url"],
    }

    return endpoint_dict


@blueprint.route("/translocations/<model_id>")
def get_translocation_data_by_cell_line(model_id):
    translocation_data_object: DataTable = get_translocation_by_cell_line_table(
        model_id
    )
    result_json_data = get_json_from_data_table(translocation_data_object)

    # Generating hyperlinks for genes and replacing gene names with the hyperlinks
    for item in result_json_data:
        item["Gene 1"] = get_gene_link(gene_name=item["Gene 1"])
        item["Gene 2"] = get_gene_link(gene_name=item["Gene 2"])

    endpoint_dict = {
        "columns": translocation_data_object.renamed_cols,
        "data": result_json_data,
        "default_columns_to_show": translocation_data_object.default_cols_to_show,
        "download_url": translocation_data_object.data_for_ajax_partial_temp()[
            "download_url"
        ],
    }

    return endpoint_dict


def get_json_from_data_table(data_object: DataTable):
    json_data = json.loads(
        data_object.json_data()
    )  # returns a dict of cols as list and data as list of lists
    columns = data_object.renamed_cols
    result_json_data = [
        dict(zip(columns, inner)) for inner in json_data["data"]
    ]  # Converting the cols and data into a list of
    # dicts where the cols are keys and datapoints are values for each sublist of data
    return result_json_data


def get_gene_link(gene_name):
    return {
        "type": "link",
        "name": f"{gene_name}",
        "url": url_for("gene.view_gene", gene_symbol=gene_name),
    }
