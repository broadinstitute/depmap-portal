from io import StringIO
from math import isnan
import matplotlib
from matplotlib import gridspec
from flask import current_app, url_for
from typing import List, Optional
from mypy_extensions import TypedDict
from depmap.enums import DataTypeEnum, GeneTileEnum
from depmap.entity.views.executive import (
    remove_svg_height_width,
    format_enrichment_box_for_dataset,
    format_generic_distribution_plot,
)
from depmap.utilities import color_palette
from depmap.dataset.models import (
    DATASET_NAME_TO_FEATURE_TYPE,
    DependencyDataset,
    BiomarkerDataset,
    Mutation,
    TabularDataset,
)
from depmap.gene.models import (
    GeneExecutiveInfo,
    Gene,
)
from depmap.correlation.utils import get_all_correlations
from collections import namedtuple

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# more hackery with seaborn: seaborn changes how it computes the bandwidth depending on whether the statsmodel lib is installed or not.
# however the statsmodel function (_statsmodels_univariate_kde) fails with an exception if the number of points is too small. We prefer the
# simpler, but more robust method be used, so override this global variable which controls which is being used.
import seaborn.distributions as seaborn_dist

seaborn_dist._has_statsmodels = False


CorrelationTable = namedtuple(
    "CorrelationTable",
    "dataset_display_name dataset_name entries all_labels is_crispr is_rnai",
)


class Entry:
    def __init__(
        self,
        label: str,
        gene_url: str,
        interactive_url: str,
        correlation: float,
        dataset_name: str,
    ):
        self.label = label
        self.gene_url = gene_url
        self.interactive_url = interactive_url
        self.correlation = correlation
        self.dataset_name = dataset_name


class CodependencyEntry(Entry):
    pass


class CelfieEntry(Entry):
    def __init__(
        self,
        label: str,
        gene_url: str,
        interactive_url: str,
        correlation: float,
        dataset_name: str,
        feature_type: str,
    ):
        super().__init__(label, gene_url, interactive_url, correlation, dataset_name)
        self.feature_type = feature_type


# sort cards into columns of roughly-equal heights based on hard-coded guesstimated heights
# header cards should always appear in the top row
def get_order(has_predictability):
    # hardcoded approximate heights of the different cards.  These values are used for sorting cards into columns such that column heights are as close as they can be
    tile_large = 650
    tile_medium = 450
    tile_small = 300
    header_cards = {
        GeneTileEnum.essentiality.value: tile_medium,
        GeneTileEnum.selectivity.value: tile_large,
        GeneTileEnum.omics.value: tile_medium,
        GeneTileEnum.predictability.value: tile_large,
    }
    anywhere_cards = {
        GeneTileEnum.target_tractability.value: tile_small,
        GeneTileEnum.codependencies.value: tile_medium,
        GeneTileEnum.mutations.value: tile_small,
        GeneTileEnum.gene_score_confidence.value: tile_medium,
        GeneTileEnum.celfie.value: tile_large,
        GeneTileEnum.targeting_compounds.value: tile_medium,
    }
    bottom_left_card = (GeneTileEnum.description.value, tile_small)

    num_cols = len(header_cards)
    order = []
    running_totals = []
    for i in range(num_cols):
        order.append([])
        running_totals.append(0)

    for index, card in enumerate(header_cards.items()):
        if not (card[0] == "predictability" and not has_predictability):
            order[index].append(card)
            running_totals[index] += card[1]

    running_totals[num_cols - 1] += bottom_left_card[1]

    tuple_list = [(k, v) for k, v in anywhere_cards.items()]
    sorted_tuples = sorted(tuple_list, key=lambda x: x[1])
    for index, card in enumerate(sorted_tuples):
        if not (card[0] == "predictability" and not has_predictability):
            min_group_index = running_totals.index(min(running_totals))
            order[min_group_index].append(card)
            # Running total calculates which is the shortest column before adding a card
            running_totals[min_group_index] += card[1]

    order[num_cols - 1].append(bottom_left_card)
    return order


def format_dep_dist_and_enrichment_boxes(gene, crispr_dataset, rnai_dataset):
    """
    Handles logic for whether a given gene should have some combination of, for crispr and rnai:
        dep dist
            svg?
            info?
        enrichment boxes?

    Specifically, handles the exception for genes that are missing from the crispr dataset but might have some reason for being missing that we need to show
    """
    dep_dist = None
    enrichment_boxes = None

    if crispr_dataset or rnai_dataset:  # we have data for either
        dep_dist_svg = format_dep_dist_svg(gene, crispr_dataset, rnai_dataset)
        dep_dist_info = format_dep_dist_info(gene, crispr_dataset, rnai_dataset)
        dep_dist = {"svg": dep_dist_svg, "info": dep_dist_info}
        enrichment_boxes = format_enrichment_boxes(gene, crispr_dataset, rnai_dataset)

    if not crispr_dataset:
        # crispr has an exception where
        #     1. we don't have data
        #     2. we have gene exec info which only contains the reason why the gene
        #        was deliberately dropped.
        crispr_dep_dist = format_crispr_possible_missing_reason(gene)
        if crispr_dep_dist:
            if not dep_dist:
                dep_dist = {"info": {}}
            dep_dist["info"]["crispr"] = crispr_dep_dist

    return dep_dist, enrichment_boxes


def format_dep_dist_svg(
    gene: Gene,
    crispr_dataset: Optional[DependencyDataset],
    rnai_dataset: Optional[DependencyDataset],
):
    fig = plt.figure(figsize=(4.5, 1.8))  # this has to be done first
    gs = gridspec.GridSpec(2, 1, hspace=0, height_ratios=[4, 1])
    ax1 = fig.add_subplot(gs[0, 0])  # top distribution plot
    ax2 = fig.add_subplot(gs[1, 0], sharex=ax1)  # bottom eventplot
    ax1.set_zorder(2)  # make ax1 x axis ticks appear

    eventplot_values = []
    eventplot_colors = []

    if crispr_dataset:
        crispr_values = [
            x
            for x in crispr_dataset.matrix.get_values_by_entity(gene.entity_id)
            if not isnan(x)
        ]
        # create kernel density estimation(kde) plot
        ax1 = sns.kdeplot(crispr_values, ax=ax1)
        crispr_line = ax1.lines[0]
        ax1.fill_between(
            crispr_line.get_xdata(),
            crispr_line.get_ydata(),
            facecolor=color_palette.crispr_color,
            alpha=0.4,
        )
        ax1.lines[0].set_linestyle("None")  # remove lines on the kdeplot
        rnai_line_index = 1
        eventplot_values.append(crispr_values)
        eventplot_colors.append(color_palette.crispr_color)
    else:
        rnai_line_index = 0

    if rnai_dataset:
        rnai_values = [
            x
            for x in rnai_dataset.matrix.get_values_by_entity(gene.entity_id)
            if not isnan(x)
        ]
        ax1 = sns.kdeplot(rnai_values, ax=ax1)
        rnai_line = ax1.lines[
            rnai_line_index
        ]  # fixme not a fan of this incremental position indexing, but better than indexing later and assuming crispr is first
        ax1.fill_between(
            rnai_line.get_xdata(),
            rnai_line.get_ydata(),
            facecolor=color_palette.rnai_color,
            alpha=0.4,
        )
        ax1.lines[rnai_line_index].set_linestyle("None")
        eventplot_values.append(rnai_values)
        eventplot_colors.append(color_palette.rnai_color)

    # Eventplot. reverse list to put crispr on top
    ax2.eventplot(
        list(reversed(eventplot_values)),
        colors=list(reversed(eventplot_colors)),
        linewidths=1,
    )
    y_max = np.concatenate([line.get_ydata() for line in ax1.lines]).max()
    ax1.plot(
        [-1, -1], [0, y_max], linestyle="dashed", color="red"
    )  # TODO: remove the hardcoding of y axis
    ax2.plot([-1, -1], [-2, 2], linestyle="dashed", color="red")
    ylim_bottom = -0.5 if len(eventplot_values) == 2 else 0.5
    ax2.set_ylim(bottom=ylim_bottom, top=1.5)

    # set ax1 axis/label visibilities
    ax1.set(ylabel=None)
    ax1.spines["left"].set_position("zero")
    ax1.spines["right"].set_visible(False)
    ax1.spines["top"].set_visible(False)
    ax1.tick_params(
        axis="y", which="both", left=False, labelleft=False
    )  # remove axes ticks on y
    ax1.tick_params(axis="x", which="both", labelbottom=False)  # remove axes ticks on x

    # set ax2 axis/label visibilities
    ax2.spines["bottom"].set_visible(False)
    ax2.spines["left"].set_position("zero")
    ax2.spines["right"].set_visible(False)
    ax2.spines["top"].set_visible(False)
    ax2.tick_params(
        axis="y", which="both", left=False, labelleft=False
    )  # remove axes ticks on y
    ax2.tick_params(axis="x", which="both", bottom=False)  # remove axes ticks on x

    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


class DepDistInfo(TypedDict, total=False):
    num_lines: str
    is_common_essential: bool
    is_strongly_selective: bool
    display_name: str


class CrisprDepDistInfo(DepDistInfo, total=False):
    should_show_dropped_by_chronos: bool


class GeneExecutiveInfoDict(TypedDict, total=False):
    crispr: CrisprDepDistInfo
    rnai: DepDistInfo


class DepDist(TypedDict, total=False):
    svg: str
    info: GeneExecutiveInfoDict


def format_dep_dist_info(
    gene: Gene,
    crispr_dataset: Optional[DependencyDataset],
    rnai_dataset: Optional[DependencyDataset],
) -> GeneExecutiveInfoDict:
    """
    This function should only be called if the gene is in the provided dataset(s)
    """
    gene_executive_info: GeneExecutiveInfoDict = {}

    if crispr_dataset:
        crispr_info = GeneExecutiveInfo.get(gene.entity_id, crispr_dataset.name)
        gene_executive_info["crispr"] = {
            "num_lines": "{}/{}".format(
                crispr_info.num_dependent_cell_lines, crispr_info.num_lines_with_data
            ),
            "is_common_essential": crispr_info.is_common_essential,
            "is_strongly_selective": crispr_info.is_strongly_selective,
            "display_name": crispr_dataset.display_name,
        }

    if rnai_dataset:
        rnai_info = GeneExecutiveInfo.get(gene.entity_id, rnai_dataset.name)
        gene_executive_info["rnai"] = {
            "num_lines": "{}/{}".format(
                rnai_info.num_dependent_cell_lines, rnai_info.num_lines_with_data
            ),
            "is_common_essential": rnai_info.is_common_essential,
            "is_strongly_selective": rnai_info.is_strongly_selective,
            "display_name": rnai_dataset.display_name,
        }

    return gene_executive_info


def format_crispr_possible_missing_reason(gene: Gene,) -> Optional[CrisprDepDistInfo]:
    """
    It is possible that we do not want to populate crispr info for this gene
    For instance, we do not want to show this if the default crispr enum is not chronos
    """
    default_crispr_datatset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    )

    if default_crispr_datatset:
        info = GeneExecutiveInfo.get(
            gene.entity_id, default_crispr_datatset.name, must=False
        )
    else:
        info = None

    if info and info.is_dropped_by_chronos:
        assert default_crispr_datatset, f"Missing {default_crispr_datatset.name}"

        # building the dictionary this way avoids throwing a mypy error
        crispr_dep_dist: CrisprDepDistInfo = {}
        crispr_dep_dist["should_show_dropped_by_chronos"] = info.is_dropped_by_chronos
        crispr_dep_dist["display_name"] = default_crispr_datatset.display_name

        return crispr_dep_dist
    else:
        # this would occur if other crispr reasons were loaded into the database, or if the default crispr enum is not chronos
        return None


def format_enrichment_boxes(gene, crispr_dataset, rnai_dataset):
    enrichment_boxes = []

    if crispr_dataset:
        crispr_box = format_enrichment_box_for_dataset(
            gene, crispr_dataset, color_palette.crispr_color
        )
        crispr_box["title"] = crispr_dataset.display_name
        enrichment_boxes.append(crispr_box)
    if rnai_dataset:
        rnai_box = format_enrichment_box_for_dataset(
            gene, rnai_dataset, color_palette.rnai_color
        )
        rnai_box["title"] = rnai_dataset.display_name
        enrichment_boxes.append(rnai_box)
    return enrichment_boxes


def plot_mutation_profile(variant_counts):
    fig, ax = plt.subplots(figsize=(3, 3))
    variants, counts = zip(*variant_counts)
    ax.barh(variants, counts)

    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    ax.spines["left"].set_visible(False)
    plt.tick_params(axis="y", which="both", left=False)  # remove axes marks on y

    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


def format_mutation_profile(gene_id):
    variant_counts = Mutation.get_variant_classification_cnt_for_gene(gene_id)
    if len(variant_counts) == 0:
        return None

    svg = plot_mutation_profile(variant_counts)

    dataset_display_name = TabularDataset.get_by_name(
        TabularDataset.TabularEnum.mutation, must=False
    ).display_name

    return {"plot": svg, "dataset_display_name": dataset_display_name}


def make_correlations_table(gene_symbol: str, dataset, df, has_omics_dataset_ids: bool):
    entries = []

    all_labels = set([gene_symbol])
    all_labels.update(df["other_entity_label"])

    for rec in df.iloc[:5, :].to_dict("records"):
        gene_url = url_for("gene.view_gene", gene_symbol=rec["other_entity_label"])
        interactive_url = url_for(
            "data_explorer_2.view_data_explorer_2",
            xDataset=dataset.name.value,
            yDataset=rec["other_dataset_name"].value
            if has_omics_dataset_ids
            else dataset.name.value,
            yFeature=rec["other_entity_label"],
            xFeature=gene_symbol,
        )
        entries.append(
            CodependencyEntry(
                rec["other_entity_label"],
                gene_url,
                interactive_url,
                rec["correlation"],
                rec["other_dataset"],
            )
            if not has_omics_dataset_ids
            else CelfieEntry(
                rec["other_entity_label"],
                gene_url,
                interactive_url,
                rec["correlation"],
                rec["other_dataset"],
                DATASET_NAME_TO_FEATURE_TYPE[rec["other_dataset_name"].value],
            )
        )

    return CorrelationTable(
        dataset.display_name,
        dataset.name.value,
        entries,
        "\n".join(all_labels),
        dataset.data_type == DataTypeEnum.crispr,
        dataset.data_type == DataTypeEnum.rnai,
    )


def generate_correlations_table_from_datasets(
    gene_symbol: str,
    dependency_datasets_list: List[DependencyDataset],
    omics_dataset_ids: List[int] = None,
):
    results = []
    for d in dependency_datasets_list:
        if d is not None:
            correlations = get_all_correlations(
                d.matrix_id,
                gene_symbol,
                max_per_other_dataset=100,
                other_dataset_ids=[d.dataset_id]
                if omics_dataset_ids is None
                else omics_dataset_ids,
            )

            has_omics_dataset_ids = omics_dataset_ids is not None
            if correlations.shape[0] > 0:
                results.append(
                    make_correlations_table(
                        gene_symbol, d, correlations, has_omics_dataset_ids
                    )
                )
    return results


def format_codependencies(gene_symbol):
    crispr_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    )
    assert crispr_dataset
    rnai_dataset = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.rnai
    )
    dataset_list = [crispr_dataset, rnai_dataset]
    return generate_correlations_table_from_datasets(gene_symbol, dataset_list)
