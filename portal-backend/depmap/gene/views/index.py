import os
import tempfile
import zipfile
from typing import List
from depmap.enums import DataTypeEnum
import pandas as pd
import json

from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    send_file,
    url_for,
)
from depmap.compound.models import Compound, CompoundExperiment
from depmap.dataset.models import BiomarkerDataset, DependencyDataset
from depmap.entity.views.index import format_celfie, format_summary
from depmap.extensions import memoize_without_user_permissions
from depmap.gene.models import Gene
from depmap.gene.views import characterization
from depmap.gene.views.confidence import format_confidence, has_gene_confidence
from depmap.gene.views.executive import format_mutation_profile, get_order
from depmap.predictability.models import PredictiveFeatureResult, PredictiveModel
from depmap.predictability.utilities import (
    get_predictability_input_files_downloads_link,
)
from depmap.tile.views import (
    find_compounds_targeting_gene,
    get_correlations_for_celfie_react_tile,
    get_omics,
)
from depmap.utilities.sign_bucket_url import get_signed_url
from depmap.correlation.utils import get_all_correlations
from depmap.partials.views import format_csv_response
from depmap.partials.data_table.factories import (
    get_mutation_by_gene_table,
    get_fusion_by_gene_table,
)

blueprint = Blueprint("gene", __name__, url_prefix="/gene", static_folder="../static")


def dependency_datasets_with_gene(entity_id):
    """
    Return the dependency datasets the gene is in
    This is not useful for compounds without also retrieving the compound_experiments associated with a dataset
    Hence naming the function 'with_gene', so it it not accidentally used for compounds (although it will take compound id without complaint)
    """
    return DependencyDataset.find_datasets_with_entity_ids([entity_id])


def biomarker_datasets_with_gene(entity_id):
    """
    Return the biomarker datasets the gene is in and includes related and includes related entities with the gene (ie antibodies and proteins)
    This is not useful for compounds without also retrieving the compound_experiments associated with a dataset
    Hence naming the function 'with_gene', so it it not accidentally used for compounds (although it will take compound id without complaint)
    """
    biomarker_datasets = []
    for biomarker_dataset in BiomarkerDataset.query.all():
        if BiomarkerDataset.has_entity(biomarker_dataset.name, entity_id, direct=False):
            biomarker_datasets.append(biomarker_dataset)
    return biomarker_datasets


@blueprint.route("/<gene_symbol>")
def view_gene(gene_symbol):
    """
    Gene page for one gene
    """
    # fetching these can be safely cached
    template_parameters = _get_gene_page_template_parameters(gene_symbol)

    # but this template has a call to is_mobile which cannot safely be cached
    return render_template("genes/index.html", **template_parameters)


@memoize_without_user_permissions()
def _get_gene_page_template_parameters(gene_symbol):
    gene = Gene.query.filter_by(label=gene_symbol).one_or_none()
    if gene is None:
        abort(404)
    # Figure out entity_id
    entity_id = gene.entity_id
    # Figure out membership in different datasets
    dependency_datasets = dependency_datasets_with_gene(entity_id)
    # TODO: Gene confidence is probably something we can delete...
    chronos_achilles_dataset_for_confidence = next(  # only confidence should be using hardcoded chronos_achilles instead of the default crispr dataset
        (
            x
            for x in dependency_datasets
            if x.name == DependencyDataset.DependencyEnum.Chronos_Achilles
        ),
        None,
    )
    default_crispr_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    )
    crispr_dataset = (
        default_crispr_dataset
        if default_crispr_dataset in dependency_datasets
        else None
    )
    default_rnai_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.rnai
    )
    rnai_dataset = (
        default_rnai_dataset if default_rnai_dataset in dependency_datasets else None
    )

    biomarker_datasets = biomarker_datasets_with_gene(entity_id)
    # if there are biomarker datasets and dependency datasets
    has_datasets = len(biomarker_datasets) > 0 or len(dependency_datasets) > 0
    summary = format_gene_summary(gene, dependency_datasets)
    has_confidence = has_gene_confidence(gene, chronos_achilles_dataset_for_confidence)
    characterizations = characterization.format_characterizations(
        entity_id, gene_symbol, biomarker_datasets
    )

    has_predictability = (
        crispr_dataset is not None
        and PredictiveModel.get_top_models_features(
            crispr_dataset.dataset_id, entity_id
        )
        is not None
    ) or (
        rnai_dataset is not None
        and PredictiveModel.get_top_models_features(rnai_dataset.dataset_id, entity_id)
        is not None
    )

    has_celfie = (
        current_app.config["ENABLED_FEATURES"].celfie and crispr_dataset is not None
    )
    if has_celfie:
        celfie = format_celfie(gene.symbol, summary["summary_options"])

    correlations = get_correlations_for_celfie_react_tile(gene, has_celfie)
    omics = get_omics(gene)
    show_omics_expression_tile = (
        omics is not None and omics.get("copy_number") is not None
    )
    mutation = format_mutation_profile(entity_id)
    show_mutations_tile = False
    if mutation:
        show_mutations_tile = True

    targeting_compounds = find_compounds_targeting_gene(gene_symbol)
    show_targeting_compounds_tile = len(targeting_compounds) > 0

    template_parameters = dict(
        gene_name=gene_symbol,
        title=gene_symbol,
        entity_id=entity_id,
        has_datasets=has_datasets,
        summary=summary,
        has_confidence=has_confidence,
        characterizations=characterizations,
        has_predictability=has_predictability,
        predictability_custom_downloads_link=get_predictability_input_files_downloads_link(),
        predictability_methodology_link=get_signed_url(
            "shared-portal-files", "Tools/Predictability_methodology.pdf"
        ),
        about={
            "entrez_id": gene.entrez_id,
            "symbol": gene.symbol,
            "full_name": gene.name,
            "aka": ", ".join([alias.alias for alias in gene.entity_alias.all()]),
            "ensembl_id": gene.ensembl_id,  # lazy to rename, this isn't just entrez
            "hngc_id": gene.hgnc_id,
        },
        pubmed_search_terms=[gene_symbol, gene_symbol + " AND cancer"],
        order=get_order(has_predictability),
        has_celfie=has_celfie,
        celfie=celfie if has_celfie else None,
        correlations=correlations,
        show_mutations_tile=show_mutations_tile,
        show_omics_expression_tile=show_omics_expression_tile,
        show_targeting_compounds_tile=show_targeting_compounds_tile,
    )
    return template_parameters


@blueprint.route("/geneUrlRoot")
def get_gene_url_route():
    return jsonify(url_for("gene.view_gene", gene_symbol=""))


@blueprint.route("/compound/<gene_symbol>")
def get_compounds_targeting_gene(gene_symbol):
    compounds = Compound.query.filter(
        Compound.target_gene.any(Gene.label == gene_symbol)
    ).all()
    return jsonify(
        [
            {
                "label": c.label,
                "target_or_mechanism": c.target_or_mechanism,
                "phase": c.phase,
                "broadId": c.broad_id,
            }
            for c in compounds
        ]
    )


def format_gene_summary(gene, dependency_datasets):
    if len(dependency_datasets) == 0:
        return None
    default_color = BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
    default_size_enum = BiomarkerDataset.BiomarkerEnum.expression

    # Format dependency options
    summary_options = [
        format_summary_option(dataset, gene, dataset.display_name)
        for dataset in dependency_datasets
    ]
    first_entity = gene
    first_dep_enum_name = summary_options[0]["dataset"]
    return format_summary(
        summary_options,
        first_entity,
        first_dep_enum_name,
        default_size_enum,
        default_color,
    )


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


@blueprint.route("/api/predictive")
def get_predictive_table():
    entity_id = int(request.args.get("entityId"))
    gene = Gene.get_by_entity_id(entity_id)

    datasets: List[DependencyDataset] = []
    default_crispr_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    )
    default_rnai_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.rnai
    )
    assert default_crispr_dataset is not None
    assert default_rnai_dataset is not None
    if DependencyDataset.has_entity(default_crispr_dataset.name, entity_id):
        datasets.append(default_crispr_dataset)
    if DependencyDataset.has_entity(default_rnai_dataset.name, entity_id):
        rnai_dataset = DependencyDataset.get_dataset_by_name(
            default_rnai_dataset.name.name
        )
        datasets.append(rnai_dataset)

    data = []
    for dataset in datasets:
        screen_type = None
        if dataset.data_type == DataTypeEnum.crispr:
            screen_type = "crispr"
        elif dataset.data_type == DataTypeEnum.rnai:
            screen_type = "rnai"

        models = PredictiveModel.get_all_models(dataset.dataset_id, entity_id)
        if len(models) == 0:
            continue

        model_order = {"Core_omics": 0, "Related": 1, "DNA_based": 2}
        models = [model for model in models if model.label in model_order.keys()]
        models.sort(key=lambda model: model_order.get(model.label))

        models_and_results = []
        for model in models:
            sorted_feature_results: List[PredictiveFeatureResult] = sorted(
                model.feature_results, key=lambda result: result.rank
            )
            results = []
            for feature_result in sorted_feature_results:
                related_type = feature_result.feature.get_relation_to_entity(entity_id)

                row = {
                    "featureName": feature_result.feature.feature_name,
                    "featureImportance": feature_result.importance,
                    "correlation": feature_result.feature.get_correlation_for_entity(
                        dataset, gene
                    ),
                    "featureType": feature_result.feature.feature_type,
                    "relatedType": related_type,
                    "interactiveUrl": feature_result.feature.get_interactive_url_for_entity(
                        dataset, gene
                    ),
                }
                results.append(row)

            # Hack to rename these without needing to change pipeline/db
            model_label = model.label
            if model_label == "Core_omics":
                model_label = "Core Omics"
            elif model_label == "DNA_based":
                model_label = "DNA-based"

            row = {
                "modelName": model_label,
                "modelCorrelation": model.pearson,
                "results": results,
            }
            models_and_results.append(row)
        data.append(
            {
                "screen": dataset.display_name,
                "screenType": screen_type,
                "modelsAndResults": models_and_results,
            }
        )

    return jsonify(data)


@blueprint.route("/predictability_files")
def get_predictability_files():
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    predictability_path = os.path.join(source_dir, "predictability")
    path = os.path.join(predictability_path, "genes_predictability_results.zip",)
    # Find all predictive models for datasets with genes as features and get the dataset enum
    # Note: This returns a named Tuple
    gene_dataset_enums_with_predictabilities = (
        PredictiveModel.query.filter(PredictiveModel.entity.has(type="gene"))
        .join(DependencyDataset)
        .with_entities(DependencyDataset.name)
        .distinct()
        .all()
    )

    if not os.path.exists(path):
        # Write zipfile to temporary directory. This should prevent zip file from getting messed up from concurrent calls to this function
        with tempfile.NamedTemporaryFile(
            delete=False, dir=os.path.dirname(os.path.abspath(predictability_path))
        ) as tmpfile:
            with zipfile.ZipFile(tmpfile, "w") as zf:
                for (enum,) in gene_dataset_enums_with_predictabilities:
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
                    tmpfile.name, path
                )  # this overwrites the destination if exists bc should be atomic on unix systems

    return send_file(path, mimetype="application/zip", as_attachment=True)


@blueprint.route("/gene_confidence/<gene_symbol>")
def view_gene_confidence(gene_symbol: str):
    gene = Gene.get_by_label(gene_symbol, must=False)
    if gene is None:
        abort(404)

    confidence = format_confidence(gene)
    if confidence is None:
        abort(404)

    return render_template("genes/confidence.html", confidence=confidence,)


@blueprint.route("/gene_characterization/<gene_symbol>")
def view_gene_characterzation(gene_symbol: str):
    gene = Gene.get_by_label(gene_symbol, must=False)

    if gene is None:
        abort(404)

    entity_id = gene.entity_id
    biomarker_datasets = biomarker_datasets_with_gene(entity_id)
    characterizations = characterization.format_characterizations(
        entity_id, gene_symbol, biomarker_datasets
    )

    return render_template(
        "genes/characterization.html",
        characterizations=characterizations,
        gene_name=gene_symbol,
    )


@blueprint.route("/gene_characterization_data/<gene_symbol>")
def gene_characterization_data(gene_symbol: str):
    gene = Gene.get_by_label(gene_symbol, must=False)

    if gene is None:
        abort(404)

    entity_id = gene.entity_id
    biomarker_datasets = biomarker_datasets_with_gene(entity_id)
    characterizations = characterization.format_characterizations(
        entity_id, gene_symbol, biomarker_datasets
    )

    return jsonify(characterizations)


@blueprint.route("/gene_characterization_content/<gene_symbol>/<characterization_id>")
def gene_characterization_content(gene_symbol: str, characterization_id: str):
    gene = Gene.get_by_label(gene_symbol, must=False)

    if gene is None:
        abort(404)

    entity_id = gene.entity_id
    biomarker_datasets = biomarker_datasets_with_gene(entity_id)
    characterizations = characterization.format_characterizations(
        entity_id, gene_symbol, biomarker_datasets
    )

    single_characterization = next(
        filter(lambda c: c["id"] == characterization_id, characterizations), None
    )

    return render_template(
        "genes/characterization-content.html",
        characterization=single_characterization,
        gene_name=gene_symbol,
    )


@blueprint.route("/<gene_symbol>/top_correlations")
def download_top_correlations_for_gene_dataset(gene_symbol: str):
    gene = Gene.query.filter_by(label=gene_symbol).one_or_none()
    if gene is None:
        abort(404)
    dataset_name = str(request.args.get("dataset_name"))
    dataset = DependencyDataset.get_dataset_by_name(dataset_name, must=True)
    assert dataset
    correlations = get_all_correlations(
        dataset.matrix_id,
        gene_symbol,
        max_per_other_dataset=100,
        other_dataset_ids=[dataset.dataset_id],
    )
    correlations.drop(columns="other_dataset_id", inplace=True)
    labels = correlations["other_entity_label"].tolist()
    # Get genes filtered by correlation genes list
    filtered_genes = Gene.query.filter(Gene.label.in_(labels)).with_entities(
        Gene.label, Gene.entrez_id
    )
    genes = pd.read_sql(filtered_genes.statement, filtered_genes.session.connection())
    # join the tables together on the gene label
    correlations = correlations.join(genes.set_index("label"), on="other_entity_label")
    correlations.rename(
        columns={
            "other_entity_label": "Gene",
            "other_dataset": "Dataset",
            "correlation": "Correlation",
            "entrez_id": "Entrez Id",
        },
        inplace=True,
    )
    # Reorder columns
    correlations = correlations[["Gene", "Entrez Id", "Dataset", "Correlation"]]

    return format_csv_response(
        correlations,
        "{}'s Top 100 Codependencies for {}".format(gene_symbol, dataset.display_name),
        {"index": False},
    )


@blueprint.route("/<gene_symbol>/genomic_associations")
def view_genomic_associations(gene_symbol: str):
    gene = Gene.query.filter_by(label=gene_symbol).one_or_none()
    if gene is None:
        abort(404)

    entity_id = gene.entity_id

    dependency_datasets = dependency_datasets_with_gene(entity_id)
    # Format dependency options
    dependency_datasets_options = [
        format_summary_option(dataset, gene, dataset.display_name)
        for dataset in dependency_datasets
    ]
    has_celfie = (
        current_app.config["ENABLED_FEATURES"].celfie
        and dependency_datasets_options is not None
    )
    celfie = format_celfie(gene.symbol, dependency_datasets_options)

    return render_template(
        "entities/celfie_page.html", celfie=celfie if has_celfie else None
    )


@blueprint.route("/mutations/<gene_id>")
def get_mutation_data_by_gene(gene_id):
    mutation_data_object = get_mutation_by_gene_table(
        gene_id
    )  # returns a datatable object
    mutation_data = json.loads(
        mutation_data_object.json_data()
    )  # returns a dict of cols as list and data as list of lists

    columns = mutation_data_object.renamed_cols
    data = mutation_data["data"]
    result_json_data = [
        dict(zip(columns, inner)) for inner in data
    ]  # Converting the cols and data into a list of
    # dicts where the cols are keys and datapoints are values for each sublist of data

    # Generating hyperlinks for cell lines and replacing cell line names with the hyperlinks
    for item in result_json_data:
        cell_line_name = item["Cell Line"]
        cell_line_depmap_id = item["Depmap Id"]
        item["Cell Line"] = {
            "type": "link",
            "name": f"{cell_line_name}",
            "url": url_for(
                "cell_line.view_cell_line", cell_line_name=cell_line_depmap_id
            ),
        }

    endpoint_dict = {
        "columns": columns,
        "data": result_json_data,
        "default_columns_to_show": mutation_data_object.default_cols_to_show,
        "download_url": mutation_data_object.data_for_ajax_partial_temp()[
            "download_url"
        ],
    }

    return endpoint_dict


@blueprint.route("/fusions/<gene_id>")
def get_fusion_data_by_gene(gene_id):
    fusion_data_object = get_fusion_by_gene_table(gene_id)  # returns a datatable object
    fusion_data = json.loads(
        fusion_data_object.json_data()
    )  # returns a dict of cols as list and data as list of lists

    columns = fusion_data_object.renamed_cols
    data = fusion_data["data"]
    result_json_data = [
        dict(zip(columns, inner)) for inner in data
    ]  # Converting the cols and data into a list of
    # dicts where the cols are keys and datapoints are values for each sublist of data

    # Generating hyperlinks for genes and replacing gene names with the hyperlinks
    for item in result_json_data:
        cell_line_name = item["Cell Line"]
        cell_line_depmap_id = item["Depmap Id"]
        gene1_name = item["Gene 1"]
        gene2_name = item["Gene 2"]
        item["Cell Line"] = {
            "type": "link",
            "name": f"{cell_line_name}",
            "url": url_for(
                "cell_line.view_cell_line", cell_line_name=cell_line_depmap_id
            ),
        }
        item["Gene 1"] = {
            "type": "link",
            "name": f"{gene1_name}",
            "url": url_for("gene.view_gene", gene_symbol=gene1_name),
        }
        item["Gene 2"] = {
            "type": "link",
            "name": f"{gene2_name}",
            "url": url_for("gene.view_gene", gene_symbol=gene2_name),
        }

    endpoint_dict = {
        "columns": columns,
        "data": result_json_data,
        "default_columns_to_show": fusion_data_object.default_cols_to_show,
        "download_url": fusion_data_object.data_for_ajax_partial_temp()["download_url"],
    }

    return endpoint_dict
