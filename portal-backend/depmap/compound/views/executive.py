from math import isnan
import re
from typing import List, Optional, Tuple
import matplotlib

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework

from depmap import data_access
from depmap.data_access.models import MatrixDataset
from depmap.entity.views.executive import format_generic_distribution_plot
from depmap.utilities import color_palette
from depmap.enums import DependencyEnum, CompoundTileEnum

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
        given_ids=[DependencyEnum.Rep_all_single_pt.name],
    ),
    DataAvailabilityDataset(
        label="Repurposing multi-dose",
        dose_range="1nM - 10μM",
        assay="PRISM",
        given_ids=[
            "REPURPOSING_AUC_collapsed",
            DependencyEnum.Repurposing_secondary_AUC.name,
        ],
    ),
    DataAvailabilityDataset(
        label="OncRef Lum",
        dose_range="1nM - 10μM",
        assay="PRISM",
        given_ids=[
            "Prism_oncology_AUC_collapsed",
            DependencyEnum.Prism_oncology_AUC.name,
        ],
    ),
    DataAvailabilityDataset(
        label="OncRef Seq",
        dose_range="1nM - 10μM",
        assay="PRISM",
        given_ids=[
            "Prism_oncology_seq_AUC_collapsed",
            DependencyEnum.Prism_oncology_seq_AUC.name,
        ],
    ),
]


def format_dep_dist_warnings(dataset: MatrixDataset):
    dataset_given_id = dataset.given_id if dataset.given_id else dataset.id
    s = ""
    if dataset.units == "log2(AUC)":
        s += "Please note that log2(AUC) values depend on the dose range of the screen and are not comparable across different assays. "

    if dataset.units == "AUC":
        s += "Please note that AUC values depend on the dose range of the screen and are not comparable across different assays."

    if "CTRP_AUC" in dataset_given_id:
        s += " Additionally, CTRP AUCs are not normalized by the dose range and thus have values greater than 1."

    if s != "":
        return s

    return None


def get_order(
    has_predictability: bool,
    has_heatmap: bool,
    show_enriched_lineages: bool,
    show_compound_correlated_dependencies_tile: bool,
    show_related_compounds_tile: bool,
):
    # hardcoded approximate heights of the different cards.  These values are used for sorting cards into columns such that column heights are as close as they can be
    tile_large = 650
    tile_medium = 450
    tile_small = 300

    header_cards = {CompoundTileEnum.sensitivity.value: tile_medium}

    if show_enriched_lineages:
        header_cards[CompoundTileEnum.selectivity.value] = tile_large
    header_cards[CompoundTileEnum.correlated_expression.value] = tile_small
    header_cards[CompoundTileEnum.availability.value] = tile_small

    anywhere_cards = {
        CompoundTileEnum.predictability.value: tile_large,
    }
    if show_compound_correlated_dependencies_tile:
        anywhere_cards[
            CompoundTileEnum.correlated_dependencies.value
        ] = tile_large  # TBD: Actually we want to group with CompoundTileEnum.correlations

    # Not showing in 25Q4: This tile appears to have some incorrect behavior in how
    # it chooses which compounds are "related". Disabling for now.
    if show_related_compounds_tile:
        anywhere_cards[CompoundTileEnum.related_compounds.value] = tile_medium

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


def format_dep_dist(compound: Compound, dataset: MatrixDataset):
    df = data_access.get_subsetted_df_by_labels_compound_friendly(dataset.id)
    feature_data = df.loc[compound.label]
    filtered_feature_data = [x for x in feature_data if not isnan(x)]

    color = color_palette.compound_color

    svg = format_generic_distribution_plot(filtered_feature_data, color)

    units = dataset.units

    return {
        "svg": svg,
        "title": "{} {}".format(compound.label, dataset.label),
        "num_lines": len(filtered_feature_data),
        "units": units,
        "color": color,
    }


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


# TODO: Temporary during the stepwise process of moving the legacy predictability backend over to
# use Compounds instead of Compound Experiments. Step 1 is just updating the tile, but the
# original get_predictive_models_for_compound is also used for the tab, so we need to keep the original
# get_predictive_models_for_compound around for a bit.
def TEMP_get_predictive_models_for_compound(
    compound_entity_id: str, dataset_given_id: str
) -> List[PredictiveModel]:

    model_order = {"Core_omics": 1, "Extended_omics": 2, "DNA_based": 3}

    # TODO: TEMP: We will need to update get_all_models to query using breadbox given ids and compound entity ids.
    # For now, it uses DependencyDataset "names" and compound experiment entity_ids
    models = PredictiveModel.get_all_models(dataset_given_id, compound_entity_id)
    models = sorted(models, key=lambda model: model_order[model.label])

    return models
