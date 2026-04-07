from math import isnan
import re
from typing import List, Optional, Tuple
import matplotlib

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework

from depmap.entity.views.executive import format_generic_distribution_plot
from depmap.utilities import color_palette
from depmap.enums import CompoundTileEnum

from depmap.dataset.models import DependencyDataset
from depmap.compound.models import Compound, CompoundExperiment
from depmap.predictability.models import PredictiveModel

from flask import current_app, url_for


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


def get_predictive_models_for_compound(
    compound_id: str, dataset_given_ids: List[str]
) -> List[PredictiveModel]:

    model_order = {"Core_omics": 1, "Extended_omics": 2, "DNA_based": 3}
    models_for_compound = []

    for given_id in dataset_given_ids:
        models = PredictiveModel.get_all_models(
            dataset_given_id=given_id, pred_model_feature_id=compound_id
        )
        models = sorted(models, key=lambda model: model_order[model.label])

        for model in models:
            models_for_compound.append(model)

    return models_for_compound
