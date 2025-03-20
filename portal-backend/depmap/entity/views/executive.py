import re
from depmap.context.models_new import SubtypeNode
from depmap.context_explorer.models import ContextAnalysis
from depmap.enums import DataTypeEnum
import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

from bisect import bisect
from io import StringIO
from math import isnan
from matplotlib import gridspec
from typing import List

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework

from depmap.dataset.models import DependencyDataset
from depmap.entity.models import Entity
from depmap.predictability.models import (
    PredictiveModel,
    TDPredictiveModel,
    PredictiveBackground,
)

from depmap.utilities import color_palette, iter_utils, number_utils


def remove_svg_height_width(svg_string):
    assert svg_string.startswith("<?xml version=")
    assert svg_string.endswith("</svg>\n")

    split_three_capture_groups = "(.*)(<svg[^>]+)(.*)"

    # note that the svg_open_tag group does not contain the closing ">". this is in back.
    # re.DOTALL makes "." dot match newline characters
    front, svg_open_tag, back = re.match(
        split_three_capture_groups, svg_string, re.DOTALL
    ).groups()

    svg_open_tag = re.sub(r'height="[^"]+" ', "", svg_open_tag)
    svg_open_tag = re.sub(r'width="[^"]+" ', "", svg_open_tag)

    return front + svg_open_tag + back


def format_generic_distribution_plot(values, color, y_axis_at_zero=False):
    fig = plt.figure(figsize=(4.5, 1.4))  # this has to be done first

    # set up event plot
    gs = gridspec.GridSpec(2, 1, hspace=0, height_ratios=[8, 1])
    ax1 = fig.add_subplot(gs[0, 0])  # top distribution plot
    ax2 = fig.add_subplot(gs[1, 0], sharex=ax1)  # bottom eventplot
    ax1.set_zorder(2)  # make ax1 x axis ticks appear

    ax2.eventplot(values, colors=color, linewidths=1)  # create event plot
    ylim_bottom = -0.5 if len(values) == 2 else 0.5
    ax2.set_ylim(bottom=ylim_bottom, top=1.5)

    ax2.spines["bottom"].set_visible(False)
    # handle left in handling y axis at 0 below
    ax2.spines["right"].set_visible(False)
    ax2.spines["top"].set_visible(False)
    ax2.tick_params(
        axis="y", which="both", left=False, labelleft=False
    )  # remove axes ticks on y

    ax2.tick_params(
        axis="x", which="both", bottom=False
    )  # remove axes ticks of eventplot. use the distplot ticks
    ax1.tick_params(
        axis="x", which="both", labelbottom=False
    )  # remove axes labels of displot. use the eventplot labels

    # create kernel density estimation(kde) plot
    ax1 = sns.kdeplot(values, ax=ax1)
    line = ax1.lines[0]
    ax1.fill_between(line.get_xdata(), line.get_ydata(), facecolor=color)
    ax1.lines[0].set_linestyle("None")  # remove lines on the kdeplot

    # if the values do not cross zero, don't show y axis at zero
    if (
        y_axis_at_zero
        and any(value >= 0 for value in values)
        and any(value <= 0 for value in values)
    ):
        ax1.spines["left"].set_position("zero")
        # for event plot
        ax2.spines["left"].set_position("zero")
    else:
        ax1.spines["left"].set_visible(False)
        # for event plot
        ax2.spines["left"].set_visible(False)

    ax1.set(ylabel=None)
    ax1.spines["right"].set_visible(False)
    ax1.spines["top"].set_visible(False)
    ax1.tick_params(
        axis="y", which="both", left=False, labelleft=False
    )  # remove y axis

    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


def format_enrichment_box_for_dataset(
    entity, dataset, color, title_color_override=None, negative_only=False
):
    enriched_contexts = ContextAnalysis.get_enriched_context_cell_line_p_value_effect_size(
        entity.entity_id, dataset.dataset_id, negative_only
    )
    all_values_series = dataset.matrix.get_cell_line_values_and_depmap_ids(
        entity.entity_id
    )
    all_cell_line_values = all_values_series.values.tolist()
    (
        enriched_text_labels,
        enriched_values,
        svg_all_box_positions,
        svg_all_box_numeric_labels,
    ) = format_enrichments_for_svg(enriched_contexts, all_values_series)
    svg = format_box_svg(
        all_cell_line_values,
        enriched_values,
        svg_all_box_positions,
        svg_all_box_numeric_labels,
        color,
    )
    return {
        "svg": svg,
        "labels": enriched_text_labels,
        "units": dataset.matrix.units,
        "color": color,
        "title_color": color if title_color_override is None else title_color_override,
    }


def format_enrichments_for_svg(enriched_contexts, all_values_series):
    enriched_values = []
    enriched_text_labels = []

    enriched_contexts = enriched_contexts.sort_values(["effect_size"])
    for enriched_context in enriched_contexts.itertuples():
        context_display_name = SubtypeNode.get_display_name(enriched_context.Index)

        # use index.isin instead of series.loc[enriched_context.cell_line]. the latter expects all cell lines to be present, and will generate NaN rows that need to be re-dropped
        in_series = all_values_series.loc[
            all_values_series.index.isin(enriched_context.cell_line)
        ]
        in_values = [x for x in in_series.values.tolist() if not isnan(x)]
        enriched_text_labels.append(
            "{} ({:.2e}) n={}".format(
                context_display_name, enriched_context.p_value, len(in_values),
            )
        )
        enriched_values.append(in_values)

    svg_all_box_positions = range(len(enriched_values) + 1, 0, -1)
    svg_all_box_numeric_labels = list(range(0, len(enriched_values) + 1))
    svg_all_box_numeric_labels[0] = "All"

    return (
        enriched_text_labels,
        enriched_values,
        svg_all_box_positions,
        svg_all_box_numeric_labels,
    )


def format_box_svg(
    all_cell_lines_values,
    enriched_values,
    svg_all_box_positions,
    svg_all_box_numeric_labels,
    enriched_color,
):
    """
    :param all_cell_lines_values: List of values for a particular entity for all cell lines
    :param enriched_values: List of lists of values for a particular enriched context
    :param enriched_color: Box color for enriched contexts
    :param svg_all_box_positions: Positions for all svg box plots
    :param svg_all_box_numeric_labels: Numeric labels for all svg box plots
    """
    fig, ax = plt.subplots(figsize=(8, 1 + len(enriched_values)))
    ax.spines["left"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    ax.tick_params(axis="y", which="both", left=False, labelsize=18)
    ax.tick_params(axis="x", which="both", labelsize=18)

    plot = plt.boxplot(
        [all_cell_lines_values] + enriched_values,
        patch_artist=True,
        vert=False,
        widths=0.6,
        showcaps=False,
        positions=svg_all_box_positions,
        labels=svg_all_box_numeric_labels,
    )
    plots_for_iteration = iter(
        zip(
            plot["boxes"],
            plot["medians"],
            plot["fliers"],
            iter_utils.pairwise_no_repeat(plot["whiskers"]),
        )
    )

    all_cell_lines_plot = next(plots_for_iteration)
    set_color(*all_cell_lines_plot, color_palette.background_color)

    for box, median, flier, whiskers in plots_for_iteration:
        set_color(box, median, flier, whiskers, enriched_color)

    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


def set_color(box, median, flier, whiskers, color):
    plt.setp(box, color=color)
    plt.setp(median, color="white", linewidth=2)
    plt.setp(flier, marker="|", markeredgecolor=color)
    plt.setp(whiskers[0], color=color, linewidth=3)
    plt.setp(whiskers[1], color=color, linewidth=3)


def split_feature_label(feature_label):
    """
    Given a feature label like
        SOX10 (6663)_RNAseq
        BRAF (B-Raf_Caution)_RPPA
        SSMD_Confounders
        skin_histology_I_Lin
        malignant_melanoma_histology_II_Lin
    To
        Extract the feature type
        Remove entrez ids from genes
        Replace underscores with spaces
    """
    feature_name, feature_type = feature_label.rsplit("_", 1)  # split from the right
    feature_name = re.sub(
        " \([0-9]*?\)", "", feature_name
    )  # given "SOX10 (6663)", removes (6663) including the space before it
    feature_name = feature_name.replace("_", " ")

    return feature_name, feature_type


def sort_by_model_pearson_feature_rank(df):
    """
    Separate function so that we can test this
    """
    sorted_df = df.sort_values(
        ["model_pearson", "feature_rank"], ascending=[False, True]
    )
    return sorted_df


def format_top_three_models_top_feature(sorted_df, type):
    relevant_rows = sorted_df[
        (sorted_df["feature_rank"] == 0) & (sorted_df["type"] == type)
    ].head(3)
    return [
        {
            "model_label": row["model_label"],
            "feature_name": row["feature_name"],
            "feature_type": row["feature_type"],
            "model_pearson": number_utils.format_3_sf(row["model_pearson"]),
        }
        for row in relevant_rows.to_dict("records")  # iterrows, but, safer copy
    ]


def get_percentile(gene_value, background):
    value_index = bisect(sorted(background), gene_value)
    return (
        (value_index) / len(background) * 100
    )  # bisect gives an index to the right, so no need to add one to the index


def format_tda_predictability_tile(
    entity: Entity, crispr_dataset: DependencyDataset, rnai_dataset: DependencyDataset
):

    if crispr_dataset is not None:
        crispr_df = TDPredictiveModel.get_top_models_features(
            crispr_dataset.dataset_id, entity.entity_id
        )
    if rnai_dataset is not None:
        rnai_df = TDPredictiveModel.get_top_models_features(
            rnai_dataset.dataset_id, entity.entity_id
        )

    def format_model(df):
        df["feature_name"], df["feature_type"] = zip(
            *df["feature_label"].apply(split_feature_label)
        )
        relevant_rows = df.head(5)
        features = [
            {
                "name": row["feature_name"],
                "type": row["feature_type"],
                "importance": row["feature_importance"],
            }
            for row in relevant_rows.to_dict("records")
        ]
        return {"type": "GBLAH", "features": features}

    return {
        "crispr_model": format_model(crispr_df) if crispr_dataset else None,
        "rnai_model": format_model(rnai_df) if rnai_dataset else None,
    }


def format_predictability_tile(entity: Entity, datasets: List[DependencyDataset]):
    plot_params = []

    for dataset in datasets:
        if dataset is None:
            continue
        df = PredictiveModel.get_top_models_features(
            dataset.dataset_id, entity.entity_id
        )
        if df is None:
            continue
        # TODO: It looks like we only have predictive models for datasets: Prism_oncology_AUC, RNAi_merged, Rep_all_single_pt, Chronos_Combined) but we should try to avoid hardcoding this
        if dataset.data_type == DataTypeEnum.crispr:
            dataset_type = "crispr"
            label = "CRISPR"
            color = color_palette.crispr_color
        elif dataset.data_type == DataTypeEnum.rnai:
            dataset_type = "rnai"
            label = "RNAi"
            color = color_palette.rnai_color
        elif dataset.name == DependencyDataset.DependencyEnum.Rep1M:
            dataset_type = "rep1m"
            label = "Rep1M"
            color = color_palette.rep1m_color
        elif dataset.name == DependencyDataset.DependencyEnum.Rep_all_single_pt:
            dataset_type = "rep_all_single_pt"
            label = "Repurposing Extended"
            color = color_palette.rep_all_single_pt_color
        elif dataset.name == DependencyDataset.DependencyEnum.Prism_oncology_AUC:
            dataset_type = "prism_onc_ref"
            label = "PRISM OncRef AUC"
            color = color_palette.prism_oncology_color
        else:
            # TODO: Figure out how to not hardcode above code
            raise Exception("Type not defined")

        df["type"] = dataset_type
        background = PredictiveBackground.get_background(dataset.dataset_id)
        plot_params.append(
            {
                "dataset": dataset,
                "df": df,
                "background": background,
                "label": label,
                "type": dataset_type,
                "color": color,
            }
        )

    if len(plot_params) > 1:
        unsorted_df = pd.concat([plot_param["df"] for plot_param in plot_params])
    elif len(plot_params) == 1:
        unsorted_df = plot_params[0]["df"]
    else:
        # happens when then entity exists in a dataset, but doesn't have predictive models
        return None

    sorted_df = sort_by_model_pearson_feature_rank(unsorted_df)
    # the zip(* does deconstructions that essentially allows us to create two new columns from an existing one

    predictability = {
        "plot": format_predictability_plot(plot_params, sorted_df),
        "overall_top_model": format_overall_top_model(sorted_df),
        "tables": [],
    }

    for plot_param in plot_params:
        predictability["tables"].append(
            {
                "type": plot_param["type"],
                "dataset": plot_param["dataset"].display_name,
                "top_models": format_top_three_models_top_feature(
                    sorted_df, plot_param["type"]
                ),
            }
        )
    return predictability


def format_predictability_plot(plot_params, sorted_df):
    predictability_plot = {"percentiles": []}
    plt.figure(figsize=(4.5, 1.4))  # this has to be done first

    line_index = 0
    text_height = 3.9
    for plot_param in plot_params:
        value = sorted_df[sorted_df["type"] == plot_param["type"]].iloc[0][
            "model_pearson"
        ]
        # create kernel density estimation(kde) plot
        ax = sns.kdeplot(plot_param["background"])
        line = ax.lines[line_index]
        ax.fill_between(
            line.get_xdata(), line.get_ydata(), facecolor=plot_param["color"], alpha=0.4
        )
        ax.lines[line_index].set_linestyle("None")  # remove lines on the kdeplot

        plt.plot([value, value], [0, text_height - 0.1], color=plot_param["color"])
        ax.text(
            value - 0.02,
            text_height,
            "{}\n{:.3G}".format(plot_param["label"], value),
            fontsize=12,
            fontweight=900,
            family="Lato",
            color=plot_param["color"],
            horizontalalignment="left",
        )

        predictability_plot["percentiles"].append(
            {
                "percentile": number_utils.format_3_sf(
                    get_percentile(value, plot_param["background"])
                ),
                "dataset_display_name": plot_param["dataset"].display_name,
                "type": plot_param["type"],
            }
        )

        line_index += 2  # because the plotted line for crispr counts as 1
        text_height -= 1.5

    if plot_param["type"] == "crispr" or plot_param["type"] == "rnai":
        ylim_top = 4
    elif plot_param["type"] == "repurp":
        ylim_top = 7  # 6 looks sufficient in dev, but on remote it needs 7. seems like dev is not a perfect reflection
    elif plot_param["type"] == "rep1m":
        ylim_top = 7
    elif plot_param["type"] == "rep_all_single_pt":
        ylim_top = 7
    elif plot_param["type"] == "prism_onc_ref":
        ylim_top = 7
    else:
        raise NotImplementedError

    ax.set_ylim(
        bottom=0, top=ylim_top
    )  # set a y axis limit above the value of the CRISPR label line y height
    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.set(ylabel=None)
    plt.tick_params(
        axis="y", which="both", left=False, labelleft=False
    )  # remove axes marks on y
    plt.xticks(fontsize=10)

    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    predictability_plot["svg"] = svg
    return predictability_plot


def format_overall_top_model(sorted_df):
    first_row = sorted_df.iloc[0]
    top_model_id = first_row["predictive_model_id"]
    relevant_rows = sorted_df[sorted_df["predictive_model_id"] == top_model_id].head(5)
    features = [
        {
            "name": row["feature_name"],
            "type": row["feature_type"],
            "importance": row["feature_importance"],
            "interactive_url": row["interactive_url"],
            "correlation": row["correlation"]
            if not pd.isnull(row["correlation"])
            else None,
            "related_type": row["related_type"],
        }
        for row in relevant_rows.to_dict("records")  # iterrows, but, safer copy
    ]

    return {"type": first_row["type"], "features": features}
