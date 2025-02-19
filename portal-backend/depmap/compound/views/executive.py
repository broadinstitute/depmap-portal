from math import isnan
import re
from typing import List, Optional, Tuple
import matplotlib

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework
import pandas as pd

from depmap import data_access
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
from depmap.compound.models import CompoundExperiment
from depmap.predictability.models import PredictiveModel

from depmap.download.utils import get_download_url

from flask import current_app, url_for
from dataclasses import dataclass


@dataclass
class DataAvailabilityDataset:
    label: str
    dose_range: str
    assay: str
    legacy_enum: DependencyEnum
    # If the dataset exists in breadbox, the breadbox version should be displayed
    breadbox_given_id: Optional[str]


# The set of information to show on the tile on the compound page
data_availability_datasets = [
    DataAvailabilityDataset(
        label="CTRP", 
        dose_range="1nM - 10μM", 
        assay="CellTitreGlo", 
        legacy_enum=DependencyEnum.CTRP_AUC, 
        breadbox_given_id="CTRP_AUC_collapsed"
    ),
    DataAvailabilityDataset(
        label="GDSC1", 
        dose_range="1nM - 10μM", 
        assay="Resazurin or Syto60", 
        legacy_enum=DependencyEnum.GDSC1_AUC, 
        breadbox_given_id="GDSC1_AUC_collapsed"
    ),
    DataAvailabilityDataset(
        label="GDSC2", 
        dose_range="1nM - 10μM", 
        assay="CellTitreGlo", 
        legacy_enum=DependencyEnum.GDSC2_AUC, 
        breadbox_given_id="GDSC2_AUC_collapsed"
    ),
    DataAvailabilityDataset(
        label="Repurposing single point", 
        dose_range="2.5μM", 
        assay="PRISM", 
        legacy_enum=DependencyEnum.Rep_all_single_pt, 
        breadbox_given_id="Repurposing_AUC_collapsed"
    ),
    DataAvailabilityDataset(
        label="Repurposing multi-dose",
        dose_range="1nM - 10μM",
        assay="PRISM",
        legacy_enum=DependencyEnum.Repurposing_secondary_AUC,
        breadbox_given_id=None,
    ),
    DataAvailabilityDataset(
        label="OncRef", 
        dose_range="1nM - 10μM", 
        assay="PRISM", 
        legacy_enum=DependencyEnum.Prism_oncology_AUC, 
        breadbox_given_id=None
    ),
]


def format_dep_dist_caption(
    compound_experiment_and_datasets: List[Tuple[CompoundExperiment, DependencyDataset]]
):
    # DEPRECATED: will be redesigned/replaced
    if compound_experiment_and_datasets is None:
        return None
    if any((dataset.units == "AUC" for _, dataset in compound_experiment_and_datasets)):
        s = "Please note that AUC values depend on the dose range of the screen and are not comparable across different assays."
        if any(
            (
                dataset.name == DependencyEnum.CTRP_AUC
                for _, dataset in compound_experiment_and_datasets
            )
        ):
            s += " Additionally, CTRP AUCs are not normalized by the dose range and thus have values greater than 1."
        return s
    else:
        return None


def get_order(has_predictability: bool):
    # hardcoded approximate heights of the different cards.  These values are used for sorting cards into columns such that column heights are as close as they can be
    tile_large = 650
    tile_medium = 450
    tile_small = 300
    header_cards = {
        CompoundTileEnum.sensitivity.value: tile_medium,
        CompoundTileEnum.selectivity.value: tile_small,
        CompoundTileEnum.correlations.value: tile_small,
        CompoundTileEnum.availability.value: tile_small,
    }
    anywhere_cards = {
        CompoundTileEnum.predictability.value: tile_large,
        CompoundTileEnum.celfie.value: tile_large,
    }
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
        dep_dists.append(
            {
                "svg": svg,
                "title": "{} {}".format(
                    compound_experiment.label, dataset.display_name
                ),
                "num_lines": len(values),
                "units": dataset.matrix.units,
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
            compound_experiment,
            dataset,
            colors[dataset.name],
            "default",
            negative_only=True,
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


def format_availability_tile(compound_id):
    """
    Load high-level information about which datasets the given compound
    appears in. This does NOT load the full list of datasets, but instead
    returns a curated subset that users are most interested in. 
    For example, we want to show whether there is "Repurposing" data, but don't need
    to list all of the oncref datasets (AUC, IC50, etc.).
    """
    # First, load ALL portal datasets containing the compound (for performance reasons).
    # This is faster than iterating through the datasets and checking their contents one-by-one.
    # all_compound_datasets = data_access.get_all_datasets_containing_compound(compound_id=compound_id)
    # datasets_by_id = {dataset.id: dataset for dataset in all_compound_datasets}
    # TODO: show both for now?

    breadbox_given_ids = data_access.get_breadbox_given_ids()
    # Only return datasets which both 1) contain the compound and 2) exist in our hard-coded list
    results = []
    for dataset_config in data_availability_datasets:

        # If the dataset exists in breadbox, use that version.
        bb_id = dataset_config.breadbox_given_id
        if bb_id is not None and bb_id in breadbox_given_ids:
            matrix_dataset = data_access.get_matrix_dataset(bb_id)
        # Otherwise, use the legacy version
        else:
            # TODO: do I need to keep a special check in case this dataset doesn't exist in either place?
            matrix_dataset = data_access.get_matrix_dataset(dataset_config.legacy_enum.name)

        if matrix_dataset is not None:
            dataset_url = get_download_url(matrix_dataset.taiga_id)
            cell_line_count = len(data_access.get_dataset_sample_ids(matrix_dataset.id))
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


def get_cell_line_count(dataset: DependencyEnum, entity_ids: List[int]):
    # given a set of entity_ids, return the number of cell lines which have
    # values for any of those entity_ids

    if not data_access.has_config(dataset.value):
        return 0

    # map entity_ids to row_indices
    row_summaries = data_access.get_all_row_indices_labels_entity_ids(dataset.value)
    row_index_by_entity_id = {x.entity_id: x.index for x in row_summaries}
    row_indices = []
    for entity_id in entity_ids:
        if entity_id in row_index_by_entity_id:
            row_indices.append(row_index_by_entity_id[entity_id])

    # get the corresponding data
    df: pd.DataFrame = data_access.get_subsetted_df(
        dataset_id=dataset.value, row_indices=row_indices, col_indices=None
    )

    # compute the number of columns which have at least one non-na
    return sum((~df.applymap(pd.isna)).apply(any, axis=0))


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
