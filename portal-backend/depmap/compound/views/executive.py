from math import isnan
import re
from typing import List, Optional, Tuple
import matplotlib

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework
import pandas as pd

from depmap import data_access
from depmap.data_access.models import MatrixDataset
from depmap.entity.views.executive import (
    format_enrichment_box_for_dataset,
    format_generic_distribution_plot,
)
from depmap.utilities import color_palette
from depmap.enums import DependencyEnum, CompoundTileEnum

colors = {
    DependencyEnum.GDSC1_AUC: color_palette.gdsc_color,
    DependencyEnum.GDSC2_AUC: color_palette.gdsc_color,
    DependencyEnum.CTRP_AUC: color_palette.ctrp_color,
    DependencyEnum.Repurposing_secondary_AUC: color_palette.repurp_color,
    DependencyEnum.Rep1M: color_palette.rep1m_color,
    DependencyEnum.Rep_all_single_pt: color_palette.rep_all_single_pt_color,
    DependencyEnum.Prism_oncology_AUC: color_palette.prism_oncology_color,
}
from depmap.correlation.utils import get_all_correlations

from depmap.dataset.models import BiomarkerDataset, DependencyDataset
from depmap.compound.models import Compound, CompoundExperiment
from depmap.predictability.models import PredictiveModel

from depmap.download.utils import get_download_url

from flask import current_app, url_for
from dataclasses import dataclass


@dataclass
class DataAvailabilityDataset:
    label: str
    dose_range: str
    assay: str
    # There are multiple given IDs we may use to load the relevant dataset
    # If a re-indexed dataset exists in breadbox, that should be displayed.
    # Otherwise, just display the legacy version
    given_ids: list[str]


# The set of information to show on the tile on the compound page
data_availability_datasets = [
    DataAvailabilityDataset(
        label="CTRP",
        dose_range="1nM - 10μM",
        assay="CellTitreGlo",
        given_ids=["CTRP_AUC_collapsed", DependencyEnum.CTRP_AUC.name],
    ),
    DataAvailabilityDataset(
        label="GDSC1",
        dose_range="1nM - 10μM",
        assay="Resazurin or Syto60",
        given_ids=["GDSC1_AUC_collapsed", DependencyEnum.GDSC1_AUC.name],
    ),
    DataAvailabilityDataset(
        label="GDSC2",
        dose_range="1nM - 10μM",
        assay="CellTitreGlo",
        given_ids=["GDSC2_AUC_collapsed", DependencyEnum.GDSC2_AUC.name],
    ),
    DataAvailabilityDataset(
        label="Repurposing single point",
        dose_range="2.5μM",
        assay="PRISM",
        given_ids=["REPURPOSING_AUC_collapsed", DependencyEnum.Rep_all_single_pt.name],
    ),
    DataAvailabilityDataset(
        label="Repurposing multi-dose",
        dose_range="1nM - 10μM",
        assay="PRISM",
        given_ids=[DependencyEnum.Repurposing_secondary_AUC.name],
    ),
    DataAvailabilityDataset(
        label="OncRef",
        dose_range="1nM - 10μM",
        assay="PRISM",
        given_ids=[
            "Prism_oncology_AUC_collapsed",
            DependencyEnum.Prism_oncology_AUC.name,
        ],
    ),
]


def format_dep_dist_caption(
    compound_experiment_and_datasets: List[Tuple[CompoundExperiment, DependencyDataset]]
):
    # DEPRECATED: will be redesigned/replaced
    if compound_experiment_and_datasets is None:
        return None

    s = ""
    if any(
        (
            dataset.units == "log2(AUC)"
            for _, dataset in compound_experiment_and_datasets
        )
    ):
        s += "Please note that log2(AUC) values depend on the dose range of the screen and are not comparable across different assays. "

    if any((dataset.units == "AUC" for _, dataset in compound_experiment_and_datasets)):
        s += "Please note that AUC values depend on the dose range of the screen and are not comparable across different assays."

    if any(
        (
            dataset.name == DependencyEnum.CTRP_AUC
            for _, dataset in compound_experiment_and_datasets
        )
    ):
        s += " Additionally, CTRP AUCs are not normalized by the dose range and thus have values greater than 1."

    if s != "":
        return s

    return None


def get_order(
    has_predictability: bool, has_heatmap: bool, show_enriched_lineages: bool
):
    # hardcoded approximate heights of the different cards.  These values are used for sorting cards into columns such that column heights are as close as they can be
    tile_large = 650
    tile_medium = 450
    tile_small = 300

    header_cards = {CompoundTileEnum.sensitivity.value: tile_medium}

    if show_enriched_lineages:
        header_cards[CompoundTileEnum.selectivity.value] = tile_large
    header_cards[CompoundTileEnum.correlations.value] = tile_small
    header_cards[CompoundTileEnum.availability.value] = tile_small

    anywhere_cards = {
        CompoundTileEnum.predictability.value: tile_large,
        CompoundTileEnum.celfie.value: tile_large,
    }

    if has_heatmap:
        anywhere_cards[CompoundTileEnum.heatmap.value] = tile_medium

    bottom_left_card = (CompoundTileEnum.description.value, tile_large)

    num_cols = len(header_cards)
    order: List[List[Tuple[str, int]]] = []
    running_totals = []
    for _ in range(num_cols):
        order.append([])
        running_totals.append(0)

    for index, card in enumerate(header_cards.items()):
        if not (
            card[0] is CompoundTileEnum.predictability.value and not has_predictability
        ):
            order[index].append(card)
            running_totals[index] += card[1]

    running_totals[num_cols - 1] += bottom_left_card[1]

    tuple_list = [(k, v) for k, v in anywhere_cards.items()]
    sorted_tuples = sorted(tuple_list, key=lambda x: x[1])
    for index, card in enumerate(sorted_tuples):
        if not (
            card[0] is CompoundTileEnum.predictability.value and not has_predictability
        ):
            min_group_index = running_totals.index(min(running_totals))
            order[min_group_index].append(card)
            running_totals[min_group_index] += card[1]

    order[num_cols - 1].append(bottom_left_card)
    return order


def determine_compound_experiment_and_dataset(compound_experiment_and_datasets):
    # DEPRECATED: this method will not work with breadbox datasets. Calls to it should be replaced.
    dataset_regexp_ranking = [
        "Prism_oncology.*",
        "Repurposing_secondary.*",
        "Rep_all_single_pt.*",
        ".*",
    ]
    ce_and_d = []
    for regexp in dataset_regexp_ranking:
        for ce, d in compound_experiment_and_datasets:
            pattern = re.compile(regexp)
            if pattern.match(d.name.value):
                ce_and_d = [[ce, d]]
                return ce_and_d


def format_dep_dists(compound_experiment_and_datasets):
    # DEPRECATED: will be redesigned/replaced
    if compound_experiment_and_datasets is None:
        return None
    dep_dists = []
    for compound_experiment, dataset in compound_experiment_and_datasets:
        values = [
            x
            for x in dataset.matrix.get_values_by_entity(compound_experiment.entity_id)
            if not isnan(x)  # needed for num_lines, and probably the plot
        ]
        color = colors[dataset.name]

        svg = format_generic_distribution_plot(values, color)
        # Transform AUC to log2(AUC) for display
        units = dataset.matrix.units
        if units == "AUC":
            units = "log2(AUC)"

        dep_dists.append(
            {
                "svg": svg,
                "title": "{} {}".format(
                    compound_experiment.label, dataset.display_name
                ),
                "num_lines": len(values),
                "units": units,
                "color": color,
            }
        )
    return dep_dists


def format_enrichment_boxes(compound_experiment_and_datasets):
    if compound_experiment_and_datasets is None:
        return None
    enrichment_boxes = []
    for compound_experiment, dataset in compound_experiment_and_datasets:
        # compound dataset titles should not be colored
        enrichment_box = format_enrichment_box_for_dataset(
            compound_experiment, dataset, colors[dataset.name], "default"
        )
        enrichment_box["title"] = "{} {}".format(
            compound_experiment.label, dataset.display_name
        )
        enrichment_boxes.append(enrichment_box)
    return enrichment_boxes


def format_top_corr_table(compound_experiment_and_datasets):
    # DEPRECATED: will be replaced/redesigned
    top_correlations = get_top_correlated_expression(compound_experiment_and_datasets)
    table = []
    for _, tc in top_correlations.items():
        interactive_url = url_for(
            "data_explorer_2.view_data_explorer_2",
            xDataset=tc["compound_dataset"].values[0],
            xFeature=tc["compound_label"].values[0],
            yDataset="expression",
            yFeature=tc["other_entity_label"].values[0],
        )
        gene_url = url_for(
            "gene.view_gene", gene_symbol=tc["other_entity_label"].values[0]
        )
        table.append(
            {
                "interactive_url": interactive_url,
                "gene_url": gene_url,
                "correlation": tc["correlation"].values[0],
                "gene_symbol": tc["other_entity_label"].values[0],
            }
        )
    table = sorted(table, key=lambda x: abs(x["correlation"]), reverse=True)
    return table[:5]


def get_top_correlated_expression(compound_experiment_and_datasets):
    """
    This takes cues from format_codependencies in depmap/gene/views/executive.py and could be a candidate for a refactor
    """
    expression_dataset = BiomarkerDataset.get_dataset_by_name("expression")
    if expression_dataset is None:
        return {}
    top_correlations = {}
    for compound_experiment, dataset in compound_experiment_and_datasets:
        if dataset is not None:
            corr_df = get_all_correlations(
                dataset.matrix_id,
                compound_experiment.label,
                max_per_other_dataset=100,
                other_dataset_ids=[expression_dataset.dataset_id],
            )
            for gene in corr_df["other_entity_label"]:
                curr_row = corr_df.loc[corr_df["other_entity_label"] == gene]
                curr_row["compound_dataset"] = dataset.name.value
                curr_row["compound_label"] = compound_experiment.label
                try:
                    prev_corr_val = abs(top_correlations[gene]["correlation"].values[0])
                    curr_corr_val = abs(curr_row["correlation"].values[0])
                    if curr_corr_val > prev_corr_val:
                        top_correlations[gene] = curr_row
                except KeyError:
                    top_correlations[gene] = curr_row
    return top_correlations


def format_availability_tile(compound: Compound):
    """
    Load high-level information about which datasets the given compound
    appears in. This does NOT load the full list of datasets, but instead
    returns a curated subset that users are most interested in. 
    For example, we want to show whether there is "Repurposing" data, but don't need
    to list all of the oncref datasets (AUC, etc.).
    """
    compound_id = compound.compound_id
    # First, load ALL portal datasets containing the compound (for performance reasons).
    # This is faster than iterating through the datasets and checking their full contents one-by-one.
    all_compound_datasets = data_access.get_all_datasets_containing_compound(
        compound_id
    )
    datasets_with_compound_by_id = {}
    for dataset in all_compound_datasets:
        if dataset.given_id:
            datasets_with_compound_by_id[dataset.given_id] = dataset
        else:
            datasets_with_compound_by_id[dataset.id] = dataset

    # Only return datasets which both 1) contain the compound and 2) exist in our hard-coded list
    results = []
    for dataset_config in data_availability_datasets:
        # Use the highest priority dataset that exists
        dataset: Optional[MatrixDataset] = None
        for given_id in dataset_config.given_ids:
            if dataset is None and given_id in datasets_with_compound_by_id:
                dataset = datasets_with_compound_by_id[given_id]

        if dataset is not None:
            # Load data for this compound to determine how many cell lines have data for it
            df = data_access.get_subsetted_df_by_labels_compound_friendly(dataset.id)
            feature_data = df.loc[compound.label]
            cell_line_count = feature_data.dropna().size

            dataset_url = get_download_url(dataset.taiga_id)
            results.append(
                {
                    "dataset_name": dataset_config.label,
                    "dose_range": dataset_config.dose_range,
                    "assay": dataset_config.assay,
                    "cell_lines": cell_line_count,
                    "dataset_url": dataset_url,
                }
            )

    # Currently no filtering needs to happen here because only one DependencyDataset
    # per dataset has both dose_range and assay in its corresponding metadata
    results.sort(key=lambda x: x["dataset_name"])
    return results


def format_corr_table(compound_label, top_correlations):
    table = []
    for _, tc in top_correlations.items():
        interactive_url = url_for(
            "data_explorer_2.view_data_explorer_2",
            xDataset=tc["compound_dataset"].values[0],
            yDataset="expression",
            xFeature=compound_label,
            yFeature=tc["other_entity_label"].values[0],
        )
        gene_url = url_for(
            "gene.view_gene", gene_symbol=tc["other_entity_label"].values[0]
        )
        table.append(
            {
                "interactive_url": interactive_url,
                "gene_url": gene_url,
                "correlation": tc["correlation"].values[0],
                "gene_symbol": tc["other_entity_label"].values[0],
            }
        )
    table = sorted(table, key=lambda x: abs(x["correlation"]), reverse=True)
    return table[:50]


def get_predictive_models_for_compound(
    compound_experiment_and_datasets: List[
        Tuple[CompoundExperiment, DependencyDataset]
    ],
    filter_dataset: DependencyDataset = None,
) -> List[Tuple[CompoundExperiment, PredictiveModel]]:
    if filter_dataset:
        dataset_id = filter_dataset.dataset_id
        compound_experiment_and_datasets = [
            t for t in compound_experiment_and_datasets if t[1].dataset_id == dataset_id
        ]

    model_order = {"Core_omics": 1, "Extended_omics": 2, "DNA_based": 3}
    models_for_compound_experiments = []

    if len(compound_experiment_and_datasets) != 0:
        for compound_experiment, dataset in compound_experiment_and_datasets:
            models = PredictiveModel.get_all_models(
                dataset.dataset_id, compound_experiment.entity_id
            )
            models = sorted(models, key=lambda model: model_order[model.label])

            for model in models:
                models_for_compound_experiments.append((compound_experiment, model))
    return models_for_compound_experiments


def get_best_compound_predictability(
    compound_experiment_and_datasets: List[
        Tuple[CompoundExperiment, DependencyDataset]
    ],
    dataset: Optional[DependencyDataset],
) -> Tuple[CompoundExperiment, DependencyDataset]:
    models_for_compound_experiments = get_predictive_models_for_compound(
        compound_experiment_and_datasets, dataset
    )
    best_model_compound_experiment = None
    best_model_pearson = 0.0
    best_predictive_model_dataset = None
    for compound_experiment, model in models_for_compound_experiments:
        if model.pearson >= best_model_pearson:
            best_model_pearson = float(model.pearson)
            best_model_compound_experiment = compound_experiment
            best_predictive_model_dataset = model.dataset
    return (best_model_compound_experiment, best_predictive_model_dataset)
