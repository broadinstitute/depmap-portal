from dataclasses import dataclass
import uuid

from flask.globals import current_app
import pandas as pd

from dataclasses import dataclass
import uuid


import depmap.celfie.utils as celfie_utils
from flask import Blueprint, render_template, abort, jsonify, url_for, request
from depmap.enums import GeneTileEnum, CompoundTileEnum, CellLineTileEnum
from depmap.predictability.models import TDPredictiveModel
from depmap.entity.views.executive import (
    format_predictability_tile,
    format_generic_distribution_plot,
)
from depmap.cell_line.models_new import DepmapModel
from depmap.cell_line.views import get_image_url
from depmap.entity.models import Entity
from depmap.gene.views.confidence import format_confidence
from depmap.enums import DependencyEnum
from depmap.gene.views.executive import (
    format_mutation_profile,
    format_codependencies,
    generate_correlations_table_from_datasets,
    get_dependency_distribution,
    get_enrichment_boxes,
)
from depmap.compound.views.executive import (
    determine_compound_experiment_and_dataset,
    format_enrichment_boxes,
    get_best_compound_predictability,
    format_dep_dists,
    format_dep_dist_caption,
    format_top_corr_table,
    format_availability_tile,
)
from depmap.compound.views.index import format_about
from depmap.gene.models import Gene
from depmap.compound.models import Compound, CompoundExperiment, drc_compound_datasets
from depmap.dataset.models import DependencyDataset, BiomarkerDataset
from depmap.metmap.models import MetMap500
from depmap.extensions import cansar, breadbox
import requests
from typing import Optional, List, Tuple
from mypy_extensions import TypedDict
from math import isnan
from depmap.utilities import color_palette
from depmap.extensions import cache_without_user_permissions

blueprint = Blueprint("tile", __name__, url_prefix="/tile", static_folder="../static")

"""
Returns a json response which contains the following:
"html" is the html for the tile which will be used to set innerHTML of the container which wraps the tile (refer to async_cards.js). 
    This html should not contain the bounding div
"postRenderCallback" field is optional. 
    If provided, it should contain a js expression which when evaluated returns a callback which will be executed with the tile's containing div's ID after the innerHTML update. 
    This exists to support setting up any interactivity that is needed by the tile
"""

# use path: to be able to capture compound names such as VNLG/124 and

# erlotinib:PLX-4032 (2:1 mol/mol) which have slashes and colons.


@dataclass
class RenderedTile:
    html: str
    js_callback: str


@blueprint.route("/<subject_type>/<tile_name>/<path:identifier>")
@cache_without_user_permissions()
def render_tile(subject_type, tile_name, identifier):
    args_dict = request.args.to_dict()
    if subject_type == "gene":
        gene = Gene.query.filter_by(label=identifier).one_or_none()
        if gene is None:
            abort(404)
        rendered_tile = render_gene_tile(tile_name, gene)
    elif subject_type == "compound":
        compound = Compound.query.filter_by(label=identifier).one_or_none()
        if compound is None:
            abort(404)
        # Figure out membership in different datasets
        compound_experiment_and_datasets = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
            compound.entity_id
        )
        compound_experiment_and_datasets = [
            x for x in compound_experiment_and_datasets if not x[1].is_dose_replicate
        ]  # filter for non dose replicate datasets

        rendered_tile = render_compound_tile(
            tile_name, compound, compound_experiment_and_datasets, args_dict
        )
    elif subject_type == "cell_line":
        cell_line = DepmapModel.query.filter_by(model_id=identifier).one_or_none()
        if cell_line is None:
            abort(404)

        rendered_tile = render_cell_line_tile(tile_name, cell_line)
    else:
        abort(400)
        # add a raise here because the linter doesn't realize the abort will always raise
        # and thinks it's possible that rendered_tile will be unassigned after leaving this block
        raise Exception("the abort will prevent this from executing")

    if isinstance(rendered_tile, RenderedTile):
        html = rendered_tile.html
        js_callback = rendered_tile.js_callback
    else:
        # fall back to the original behavior: render methods return html and we use a hardcoded js snippet for all tiles
        # that didn't provide one
        assert isinstance(rendered_tile, str)
        html = rendered_tile
        js_callback = '(function(containerId){$("#"+containerId+" .popover-selector").popover()})'  # initialize js callback function

    # If html is just whitespace, coerce whitespace to empty string
    if all(s in (" ", "\n") for s in html):
        html = ""
    result = jsonify({"html": html, "postRenderCallback": js_callback})
    return result


def render_cell_line_tile(tile_name: str, cell_line: DepmapModel):
    tiles = {
        CellLineTileEnum.metmap.name: get_cell_line_metmap_html,
    }
    if tile_name not in tiles:
        abort(400)
    tile_html_fn = tiles[tile_name]
    rendered_tile = tile_html_fn(cell_line)
    return rendered_tile


def get_cell_line_metmap_html(cell_line: DepmapModel):
    metmap_models = MetMap500.get_all_by_depmap_id(cell_line.model_id)
    metmap_data = [model.serialize for model in metmap_models]

    html = render_template(
        "tiles/metmap.html", depmap_id=cell_line.model_id, metmap_data=metmap_data
    )
    # MetMap tile uses d3.js to render a plot
    js_callback = render_template(
        "tiles/metmap-petal-plot.js", depmap_id=cell_line.model_id
    )

    return RenderedTile(html, js_callback)


def render_gene_tile(tile_name, gene):
    tiles = {
        GeneTileEnum.tda_predictability.value: get_tda_predictability_html,
        GeneTileEnum.predictability.value: get_predictability_html,
        GeneTileEnum.selectivity.value: get_enrichment_html,
        GeneTileEnum.mutations.value: get_mutations_html,
        GeneTileEnum.omics.value: get_omics_html,
        GeneTileEnum.description.value: get_description_html,
        GeneTileEnum.essentiality.value: get_essentiality_html,
        GeneTileEnum.codependencies.value: get_codependencies_html,
        GeneTileEnum.gene_score_confidence.value: get_confidence_html,
        GeneTileEnum.target_tractability.value: get_tractability_html,
        GeneTileEnum.celfie.value: get_celfie_html,
        GeneTileEnum.targeting_compounds.value: get_targeting_compounds_html,
    }
    if tile_name not in tiles:
        abort(400)
    tile_html = tiles[tile_name]
    rendered_tile = tile_html(gene)
    return rendered_tile


def render_compound_tile(
    tile_name, compound, cpd_exp_and_datasets=None, query_params_dict={}
):
    tiles = {
        CompoundTileEnum.predictability.value: get_predictability_html,
        CompoundTileEnum.selectivity.value: get_enrichment_html,
        CompoundTileEnum.sensitivity.value: get_sensitivity_html,
        CompoundTileEnum.correlations.value: get_correlations_html,
        CompoundTileEnum.availability.value: get_availability_html,
        CompoundTileEnum.celfie.value: get_celfie_html,
        CompoundTileEnum.heatmap.value: get_heatmap_html,
        CompoundTileEnum.correlated_dependencies.value: get_correlated_dependencies_html,
        CompoundTileEnum.description.value: get_structure_and_detail_html,
    }

    if tile_name not in tiles:
        abort(400)
    tile_html = tiles[tile_name]
    rendered_tile = tile_html(compound, cpd_exp_and_datasets, query_params_dict)
    return rendered_tile


# TODO: Maybe put this logic above to avoid multiple calls of same datasets in multiple tiles
def get_dependency_dataset_for_entity(dep_dataset_name, entity_id):
    dataset_has_entity = DependencyDataset.has_entity(dep_dataset_name, entity_id)
    if dataset_has_entity:
        return DependencyDataset.get_dataset_by_name(dep_dataset_name)
    else:
        return None


def get_tda_predictability_html(entity):
    """
    This is the predictability tile on the td app
    This is distinct from the predictability tile on the gene page, which has different source data and uses the get_predictability_html function
    """
    gene_symbol = entity.label
    gene = Gene.query.filter_by(label=gene_symbol).one_or_none()
    if gene is None:
        abort(404)

    entity_id = gene.entity_id

    avana_dataset = DependencyDataset.get_dataset_by_name(
        DependencyDataset.DependencyEnum.Avana,
        must=True,  # this stays avana. this is for the TD app, which uses static files as inputs. This is a completely separately sourced tile compared to get_predictability_html
    )
    rnai_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.rnai
    )
    assert rnai_dataset

    def get_top_models(dataset_label: str):
        return (
            TDPredictiveModel.query.filter_by(
                dataset_label=dataset_label, entity_id=entity_id
            )
            .order_by(TDPredictiveModel.pearson.desc())
            .all()
        )

    def format(display_name: str, dataset_name: DependencyEnum):
        top_models = get_top_models(str(dataset_name))
        return {"dataset": display_name, "top_models": top_models}

    tables = [
        format(display_name, dataset_name)
        for display_name, dataset_name in [
            ("Avana", avana_dataset),
            ("RNAi", rnai_dataset),
        ]
    ]

    return render_template("tiles/tda_predictablity.html", tables=tables,)


def get_predictability_html(
    entity: Entity,
    cpd_exp_and_datasets: List[Tuple[CompoundExperiment, DependencyDataset]] = None,
    query_params_dict={},
):
    """
    This is the predictability tile on the gene page
    This is distinct from the predictability tile on the td app, which has different source data and uses the get_tda_predictability_html function
    """

    entity_type = entity.type
    if entity_type == "gene":
        default_crispr_dataset = DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr
        )
        crispr_dataset = (
            get_dependency_dataset_for_entity(
                default_crispr_dataset.name, entity.entity_id
            )
            if default_crispr_dataset
            else None
        )

        default_rnai_dataset = DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.rnai
        )
        rnai_dataset = (
            get_dependency_dataset_for_entity(
                default_rnai_dataset.name, entity.entity_id
            )
            if default_rnai_dataset
            else None
        )

        return render_template(
            "tiles/predictability.html",
            predictability=format_predictability_tile(
                entity, [crispr_dataset, rnai_dataset]
            ),
            is_gene_executive=True,  # Hard coded as True; TBD if we want TDA to show something else
            gene_symbol=entity.symbol,
            entity_type=entity_type,
        )
    elif entity_type == "compound":
        # query param intended for compound dashboard to show predictability for specific dataset
        if "datasetName" in query_params_dict:
            dep_dataset_name = query_params_dict["datasetName"]
            dataset = DependencyDataset.get_dataset_by_name(
                dep_dataset_name, must=True,
            )
        else:
            dataset = None

        best_predictive_model_for_compound = get_best_compound_predictability(
            cpd_exp_and_datasets, dataset
        )
        compound_experiment = best_predictive_model_for_compound[0]

        predictability = None
        if compound_experiment is not None:
            predictability = format_predictability_tile(
                compound_experiment, [best_predictive_model_for_compound[1]],
            )

        return render_template(
            "tiles/predictability.html",
            predictability=predictability,
            is_gene_executive=True,  # TODO: rethink attribute name since used for gene and cpd
            gene_symbol=entity.entity_id,  # Doesn't seem like I need this attribute
            entity_type=entity_type,
        )


def find_compounds_targeting_gene(gene_symbol):
    compounds = Compound.query.filter(
        Compound.target_gene.any(Gene.label == gene_symbol)
    ).all()

    return [
        {
            "compound": compound.label,
            "target_or_mechanism": compound.target_or_mechanism,
            "compound_url": url_for("compound.view_compound", name=compound.label),
        }
        for compound in compounds
    ]


def get_targeting_compounds_html(gene):
    gene_symbol = gene.label
    targeting_compounds = find_compounds_targeting_gene(gene_symbol)
    return render_template(
        "tiles/targeting_compounds.html",
        targeting_compounds=targeting_compounds,
        gene_symbol=gene_symbol,
    )


def get_enrichment_html(
    entity: Entity, compound_experiment_and_datasets=None, query_params_dict={}
):
    div_id = str(uuid.uuid4())
    entity_label = entity.label

    return RenderedTile(
        f'<div id="{div_id}">get_enrichment_html is stubbed out</div>',
        f"""(
        function() {{
            DepMap.initEnrichmentTile("{div_id}", "{entity_label}", "{entity.type}");
        }})""",
    )


def get_structure_and_detail_html(
    entity: Entity, compound_experiment_and_datasets=None, query_params_dict={}
):
    div_id = str(uuid.uuid4())
    compound_name = entity.label
    compound_id = Compound.get_by_label(compound_name).compound_id

    return RenderedTile(
        f'<div id="{div_id}"></div>',
        f"""(
        function() {{
            DepMap.initStructureAndDetailTile("{div_id}", "{compound_id}");
        }})""",
    )


def get_heatmap_html(
    entity: Entity, compound_experiment_and_datasets=None, query_params_dict={}
):
    div_id = str(uuid.uuid4())
    entity_label = entity.label
    compound = Compound.get_by_label(entity_label)
    compound_id = compound.compound_id

    return RenderedTile(
        f'<div id="{div_id}"></div>',
        f"""(
        function() {{
            DepMap.initHeatmapTile("{div_id}", "{compound_id}", "{entity_label}");
        }})""",
    )


def get_correlated_dependencies_html(
    entity: Entity, compound_experiment_and_datasets=None, query_params_dict={}
):
    # unique id to insert in DOM
    div_id = str(uuid.uuid4())
    entity_label = entity.label

    return RenderedTile(
        f'<div id="{div_id}">get_correlated_dependencies_html is stubbed out</div>',
        f"""(
        function() {{
            console.log("about to call initCorrelatedDependenciesTile");
            DepMap.initCorrelatedDependenciesTile("{div_id}", "{entity_label}");
            console.log("after initCorrelatedDependenciesTile");
        }})""",
    )


def get_mutations_html(gene):
    mutation = format_mutation_profile(gene.entity_id)
    return render_template("tiles/mutations.html", mutation=mutation)


def get_omics(gene):
    class OmicsSummary(TypedDict):
        svg: str
        units: str

    OmicsDict = TypedDict(
        "OmicsDict",
        {"expression": OmicsSummary, "copy_number": OmicsSummary},
        total=False,
    )

    biom_enum = BiomarkerDataset.BiomarkerEnum.expression
    gene_has_expr_dataset = BiomarkerDataset.has_entity(
        biom_enum, gene.entity_id, direct=False
    )
    expression_dataset = (
        BiomarkerDataset.get_dataset_by_name(biom_enum)
        if gene_has_expr_dataset
        else None
    )
    gene_has_cn_dataset = BiomarkerDataset.has_entity(
        BiomarkerDataset.BiomarkerEnum.copy_number_relative,
        gene.entity_id,
        direct=False,
    )
    copy_number_dataset = (
        BiomarkerDataset.get_dataset_by_name(
            BiomarkerDataset.BiomarkerEnum.copy_number_relative
        )
        if gene_has_cn_dataset
        else None
    )

    omics: Optional[OmicsDict]

    if expression_dataset or copy_number_dataset:
        omics = {}
        if expression_dataset:
            values = [
                x
                for x in expression_dataset.matrix.get_values_by_entity(gene.entity_id)
                if not isnan(x)
            ]
            if all(
                values[0] == value for value in values
            ):  # e.g. all expression may be floored at -3
                omics["expression"] = {
                    "dataset_display_name": expression_dataset.display_name,
                    "color": color_palette.expression_color,
                    "svg": "<p>All expression values are {} (floor is -3 {})</p>".format(
                        values[0], expression_dataset.matrix.units
                    ),
                    "units": "",
                }
            else:
                svg = format_generic_distribution_plot(
                    values, color_palette.expression_color
                )
                omics["expression"] = {
                    "dataset_display_name": expression_dataset.display_name,
                    "color": color_palette.expression_color,
                    "svg": svg,
                    "units": "Expression",  # expression_dataset.matrix.units
                }

        if copy_number_dataset:
            values = [
                x
                for x in copy_number_dataset.matrix.get_values_by_entity(gene.entity_id)
                if not isnan(x)
            ]
            svg = format_generic_distribution_plot(
                values, color_palette.copy_number_color, y_axis_at_zero=True
            )
            omics["copy_number"] = {
                "dataset_display_name": copy_number_dataset.display_name,
                "color": color_palette.copy_number_color,
                "svg": svg,
                "units": copy_number_dataset.matrix.units,
            }
    else:
        omics = None

    return omics


def get_omics_html(gene):
    # TODO: Test omics return object
    omics = get_omics(gene)

    return render_template("tiles/omics.html", omics=omics,)


def get_description_html(entity, cpd_exp_and_datasets=None, query_params_dict={}):
    entity_type = entity.type
    if entity_type == "gene":
        html = render_template(
            "tiles/description.html",
            about={
                "entrez_id": entity.entrez_id,
                "symbol": entity.symbol,
                "full_name": entity.name,
                "aka": ", ".join([alias.alias for alias in entity.entity_alias.all()]),
                "ensembl_id": entity.ensembl_id,  # lazy to rename, this isn't just entrez
                "hngc_id": entity.hgnc_id,
            },
        )

        js_callback = (
            '(function() {getAbout("' + str(entity.entrez_id) + '")})'
        )  # References function in about.js.
        return RenderedTile(html, js_callback)

    elif entity_type == "compound":
        return render_template(
            "tiles/compound_description.html", about=format_about(entity),
        )


def get_essentiality_html(gene):
    # we also only do this for the essentiality tile, because the other tiles involve precomputed results which we have not calculated for the other enums

    crispr_dataset = get_dependency_dataset_for_entity(
        DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr
        ).name,
        gene.entity_id,
    )

    rnai_dataset = get_dependency_dataset_for_entity(
        DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.rnai
        ).name,
        gene.entity_id,
    )

    dep_dist = get_dependency_distribution(gene, crispr_dataset, rnai_dataset)

    return render_template("tiles/essentiality.html", dep_dist=dep_dist,)


def get_codependencies_html(gene):
    codependencies = format_codependencies(gene.label)
    return render_template(
        "tiles/codependencies.html", codependencies=codependencies, gene=gene
    )


def get_confidence_html(gene):
    confidence = format_confidence(gene)
    return render_template("tiles/confidence.html", confidence=confidence)


from oauthlib.oauth2.rfc6749.errors import UnauthorizedClientError


def get_tractability_html(gene):
    uniprot_ids = gene.get_uniprot_ids()

    try:
        proteins = [cansar.client.get_protein(uniprot_id) for uniprot_id in uniprot_ids]
    except requests.exceptions.SSLError as e:
        print(
            "Got an SSLError because cansar site cert expired. Check if this continues in future!"
        )
        proteins = None
    except UnauthorizedClientError as e:
        print("Got unauthorized client error trying to fetch from CanSAR. Ignoring")
        proteins = None
    return render_template("tiles/tractability.html", proteins=proteins)


def get_sensitivity_html(
    compound, compound_experiment_and_datasets, query_params_dict={}
):
    # DEPRECATED: will be redesigned/replaced
    best_ce_and_d = determine_compound_experiment_and_dataset(
        compound_experiment_and_datasets
    )
    return render_template(
        "tiles/sensitivity.html",
        dep_dists=format_dep_dists(best_ce_and_d),
        dep_dist_caption=format_dep_dist_caption(best_ce_and_d),
    )


def get_correlations_html(
    compound, compound_experiment_and_datasets, query_params_dict={}
):
    # DEPRECATED: will be redesigned/replaced
    return render_template(
        "tiles/correlations.html",
        correlations=format_top_corr_table(compound_experiment_and_datasets),
    )


def get_availability_html(
    compound, compound_experiment_and_datasets, query_params_dict={}
):
    return render_template(
        "tiles/availability.html",
        name=compound.label,
        availability=format_availability_tile(compound),
    )


def get_correlations_for_celfie_react_tile(
    entity, show_celfie, compound_experiment_and_datasets=None
):
    # show tile only if env is skyros/dev
    if show_celfie:
        entity_type = entity.type
        entity_symbol = entity.label
        # Initialize dep_dataset_list
        dep_dataset_list = []

        # Get list of celfie omics datasets
        omics_dataset_ids = [
            BiomarkerDataset.get_dataset_by_name(dataset).dataset_id
            for dataset in celfie_utils.celfie_datasets
        ]

        if entity_type == "gene":
            entity_symbol = entity.label
            gene = Gene.query.filter_by(label=entity_symbol).one_or_none()
            if gene is None:
                abort(404)

            # Grab the default CRISPR and RNAi dependency datasets
            crispr_dataset = get_dependency_dataset_for_entity(
                DependencyDataset.get_dataset_by_data_type_priority(
                    DependencyDataset.DataTypeEnum.crispr
                ).name,
                entity.entity_id,
            )

            rnai_dataset = get_dependency_dataset_for_entity(
                DependencyDataset.get_dataset_by_data_type_priority(
                    DependencyDataset.DataTypeEnum.rnai
                ).name,
                entity.entity_id,
            )
            dep_dataset_list = [crispr_dataset, rnai_dataset]

        elif entity_type == "compound":
            # Show "best" dataset same as in sensitiivity tile in form [[cpd_exp, dependency_dataset]]
            # NOTE: Not sure if this should only be returning 1 dataset or a list.
            best_ce_and_d = determine_compound_experiment_and_dataset(
                compound_experiment_and_datasets
            )
            if best_ce_and_d:
                # Get only dataset
                dep_dataset_list = [
                    cpd_and_dataset[1] for cpd_and_dataset in best_ce_and_d
                ]
                # Assuming only one dataset from "best" dataset gets returned,
                # use it for correlation
                entity_symbol = best_ce_and_d[0][0].label

        # Get correlations for dependency datasets vs omics datasets
        # For compound, look into get_top_correlated_expression but
        # generate_correlations_table_from_datasets should be the same idea..
        correlations = generate_correlations_table_from_datasets(
            entity_symbol, dep_dataset_list, omics_dataset_ids
        )

        return correlations
    return []


def get_celfie_html(
    entity, compound_experiment_and_datasets=None, query_params_dict={}
):
    # DEPRECATED: will be redesigned/replaced
    # show tile only if env is skyros/dev
    show_celfie = current_app.config["ENABLED_FEATURES"].celfie

    if show_celfie:
        # Get correlations for dependency datasets vs omics datasets
        # For compound, look into get_top_correlated_expression but
        # generate_correlations_table_from_datasets should be the same idea..
        correlations = get_correlations_for_celfie_react_tile(
            entity, show_celfie, compound_experiment_and_datasets
        )

        return render_template(
            "tiles/celfie.html", correlations=correlations, show_celfie=show_celfie
        )
    # if CELFIE is not enabled, don't render anything
    return ""
