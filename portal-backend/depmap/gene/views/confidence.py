from io import StringIO
import enum
import pandas as pd
import matplotlib
from matplotlib import gridspec
from typing import Dict, Optional
from mypy_extensions import TypedDict
from flask import current_app

from depmap.entity.views.executive import remove_svg_height_width
from depmap.dataset.models import DependencyDataset
from depmap.gene.models import (
    Gene,
    GeneScoreConfidence,
    GENE_SCORE_CONFIDENCE_EVIDENCE_NAME,
    GeneScoreConfidenceCoefficient,
    GuideGeneMap,
    AchillesLogfoldChange,
)
import numpy as np
from typing import List

matplotlib.use(
    "svg", force=True
)  # this line must come before this import, otherwise matplotlib complains about python not being installed as a framework
import matplotlib.pyplot as plt
import seaborn as sns


def has_gene_confidence(
    gene: Gene, chronos_achilles_dataset: Optional[DependencyDataset]
) -> bool:
    if (
        not current_app.config["ENABLED_FEATURES"].gene_confidence
        or chronos_achilles_dataset is None
        or GeneScoreConfidence.get(gene.entity_id, must=False) is None
    ):
        return False
    return True


# returns confidence plot, confidence info text, confidence subplots, and reagent plot in one dictionary
def format_confidence(gene: Gene):
    if not current_app.config["ENABLED_FEATURES"].gene_confidence:
        return None

    # if this dataset is changed, also need to change implementation for has_gene_confidence
    chronos_achilles_dataset = DependencyDataset.get_dataset_by_name(
        DependencyDataset.DependencyEnum.Chronos_Achilles.name
    )
    if not chronos_achilles_dataset:
        return None

    gene_score_confidence_data = GeneScoreConfidence.get(gene.entity_id, must=False)
    if not gene_score_confidence_data:
        return None

    # fill feature nas with the median
    # the pipeline as this in order to train the model
    # the pipeline only writes out the outputs of the model, not in the filled in features used to train it
    # we want to visualize, for the users' understanding and interpretability, the features that were used to train the model
    # so we repeat this snippet of code that the pipeline
    # specifically, the filled in version is used for the background distribution
    # the normal, unfilled version is used for the gene's specific value
    gene_confidence_features_unfilled = (
        GeneScoreConfidence.get_all_genes_confidence_evidence()
    )
    gene_confidence_features = gene_confidence_features_unfilled.copy()

    # Converting the True/False column to 1/0 so that kdeplot can be plotted
    for column in gene_confidence_features_unfilled.columns:
        if gene_confidence_features_unfilled[column].dtypes == "bool":
            gene_confidence_features_unfilled[
                column
            ] = gene_confidence_features_unfilled[column].astype(int)
        elif gene_confidence_features_unfilled[column].dtypes == "object":
            gene_confidence_features_unfilled.drop(column, axis=1, inplace=True)
        else:
            continue

    for f in gene_confidence_features:
        gene_confidence_features[f].fillna(
            gene_confidence_features[f].median(), inplace=True
        )

    feature_labels = GeneScoreConfidence.get_feature_labels()

    gene_confidence_svg = __format_gene_confidence_svg(
        gene, gene_score_confidence_data, GeneConfidenceSvgSize.large
    )
    gene_confidence_svg_small = __format_gene_confidence_svg(
        gene, gene_score_confidence_data, GeneConfidenceSvgSize.small
    )
    gene_confidence_info = __format_gene_confidence_info(
        gene, gene_confidence_features, feature_labels, gene_score_confidence_data,
    )

    subplots = __format_gene_confidence_subplots(
        gene,
        gene_confidence_features_unfilled,
        gene_confidence_features,
        feature_labels,
    )
    reagent_plot = __format_reagent_plot(gene)
    gene_confidence_dist = {
        "dataset_display_name": chronos_achilles_dataset.display_name,
        "svg": gene_confidence_svg,
        "svg_small": gene_confidence_svg_small,  # for the executive card
        "info": gene_confidence_info,
        "subplots": subplots,
        "reagent_plot": reagent_plot,
    }
    return gene_confidence_dist


class GeneConfidenceSvgSize(enum.Enum):
    large = enum.auto()
    small = enum.auto()


# taken from Josh D's gene score confidence notebook, outputs a distribution plot showing how the given gene compares to other genes in terms of gene score confidence
def __format_gene_confidence_svg(
    gene: Gene,
    gene_score_confidence_data: GeneScoreConfidence,
    size: GeneConfidenceSvgSize,
):
    if size == GeneConfidenceSvgSize.large:
        # if the plot is large, the font can be smaller (relative to total plot area)
        xlabel_size = 16
        xticks_size = 16
        text_size = 24
    elif size == GeneConfidenceSvgSize.small:
        # if the plot is small, font size needs to be larger (relative to plot area)
        xlabel_size = 30
        xticks_size = 30
        text_size = 32
    else:
        raise ValueError("unexpected size {}".format(size))

    gene_label = gene.label
    all_confidence_scores = GeneScoreConfidence.get_all_genes_confidence_scores()
    fig = plt.figure(figsize=(14, 6))  # this determines the aspect ratio for the plot
    # fig = plt.figure(figsize=(7, 3))  # this determines the aspect ratio for the plot
    ax = fig.add_subplot(1, 1, 1)
    sns.kdeplot(
        all_confidence_scores,
        bw_method=lambda *args: 0.01,
        gridsize=1000,
        fill=True,
        label="All Genes",
    )
    top_lim = ax.get_ylim()[1]
    plt.xlim(0, 1.005)
    plt.ylim(0, top_lim)
    score = gene_score_confidence_data.score
    plt.plot([score, score], [0, 0.6 * top_lim], marker="o", color="crimson", lw=4)
    plt.yticks([])
    plt.xticks(fontsize=xticks_size)
    sns.despine(left=True)
    plt.xlabel("Gene Confidence Score", fontsize=xlabel_size)
    plt.ylabel(None)
    halign = "left"
    if score > 0.5:
        halign = "right"
    plt.text(
        x=score,
        y=0.62 * top_lim,
        s=gene_label,
        verticalalignment="bottom",
        horizontalalignment=halign,
        color="red",
        fontsize=text_size,
    )

    if ax.get_legend() is not None:
        ax.get_legend().remove()

    ax.legend(fontsize=text_size, frameon=False, loc=(0.82, 0.75))

    plt.tight_layout()
    plt.subplots_adjust(wspace=0.2)
    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


class ConfidenceDistInfo(TypedDict):
    level: str
    positive: List[str]
    negative: List[str]


# outputs text explaining why a particular gene got the confidence score it got, highlighting positive and negative factors
def __format_gene_confidence_info(
    gene: Gene,
    gene_confidence_features: pd.DataFrame,  # has is gene_id, columns GENE_SCORE_CONFIDENCE_EVIDENCE_NAME
    feature_labels: Dict[str, str],
    gene_score_confidence_data: GeneScoreConfidence,
    threshold=0.4,
) -> ConfidenceDistInfo:

    info: ConfidenceDistInfo = {"level": "", "positive": [], "negative": []}

    coefficient = GeneScoreConfidenceCoefficient.get()
    gene_confidence_score = gene_score_confidence_data.score

    feature_dists = pd.DataFrame(
        {
            evidence_name: gene_confidence_features[evidence_name]
            * getattr(coefficient, evidence_name)
            for evidence_name in GENE_SCORE_CONFIDENCE_EVIDENCE_NAME
        }
    )

    feature_dists -= feature_dists.mean()

    gene_confidence_feature = gene_confidence_features.loc[gene.entity_id]
    feature_dist = feature_dists.loc[gene.entity_id]

    if 0.5 < gene_confidence_score < 0.8:
        info["level"] = "Confidence: Middling (%1.2f)" % gene_confidence_score
    elif gene_confidence_score <= 0.5:
        info["level"] = "Confidence: Low (%1.2f)" % gene_confidence_score
    elif gene_confidence_score >= 0.8:
        info["level"] = "Confidence: High (%1.2f)" % gene_confidence_score
    else:
        raise ValueError(
            "gene confidence score must be numeric, not %r" % gene_confidence_score
        )

    helping_mapping = {1: "high", -1: "low"}
    helping = []
    hurting_mapping = {1: "low", -1: "high"}
    hurting = []

    for evidence_name in GENE_SCORE_CONFIDENCE_EVIDENCE_NAME:
        if feature_dist[evidence_name] > threshold:
            helping.append(
                "\t%s is %s: %1.2f"
                % (
                    feature_labels[evidence_name],
                    helping_mapping[np.sign(getattr(coefficient, evidence_name))],
                    gene_confidence_feature[evidence_name],
                )
            )
        elif feature_dist[evidence_name] < -threshold:
            hurting.append(
                "\t%s is %s: %1.2f"
                % (
                    feature_labels[evidence_name],
                    hurting_mapping[np.sign(getattr(coefficient, evidence_name))],
                    gene_confidence_feature[evidence_name],
                )
            )

    info["positive"] = helping
    info["negative"] = hurting

    return info


# from Josh D's notebook on gene score confidence, returns distribution plots for each feature that makes up gene score confidence and how the given gene falls within the distribution.  All the plots are exported together as a single svg
def __format_gene_confidence_subplots(
    gene: Gene,
    gene_confidence_features_unfilled: pd.DataFrame,
    gene_confidence_features: pd.DataFrame,
    feature_labels: Dict[str, str],
):
    nfeatures = gene_confidence_features_unfilled.shape[1]
    plt.close("all")
    fig = plt.figure(
        figsize=(14, 6)
    )  # this determines the aspect ratio for the subplot container
    gs = gridspec.GridSpec(4, int(np.ceil(nfeatures / 2)))

    bottom = [fig.add_subplot(gs[2, i]) for i in range(int(np.ceil(nfeatures / 2)))] + [
        fig.add_subplot(gs[3, i]) for i in range(nfeatures // 2)
    ]
    colors = sns.cubehelix_palette(
        nfeatures, start=1.5, rot=2.73, dark=0.3, light=0.5, hue=1
    )
    # make a subplot for each feature
    for b, feature, color in zip(bottom, gene_confidence_features.columns, colors):
        plt.sca(b)
        sns.despine(left=True)
        plt.yticks([])
        plt.xlabel(feature_labels[feature])
        sns.kdeplot(
            gene_confidence_features_unfilled[feature].dropna(),
            bw_method=lambda *args: 0.01,
            gridsize=1000,
            color=color,
            shade=True,
            label=None,
        )
        if b.get_legend() is not None:
            b.get_legend().remove()
        top_lim = b.get_ylim()[1]
        plt.ylim(0, top_lim)
        feat = gene_confidence_features_unfilled.loc[gene.entity_id, feature]
        if feature == "top_feature_confounder":
            plt.xticks([0, 1], ["False", "True"])
        if pd.notnull(feat):
            plt.plot([feat, feat], [0, 0.6 * top_lim], color="crimson", lw=3)

    plt.tight_layout()
    plt.subplots_adjust(wspace=0.2)
    string_buffer = StringIO()

    plt.savefig(
        string_buffer, format="svg", bbox_inches="tight", pad_inches=0
    )  # transparent true if needed
    plt.close()  # resets the figure, so that the global plot does not build up

    svg = remove_svg_height_width(string_buffer.getvalue())
    return svg


# Also from Josh D's gene score confidence python notebook.  Plots chronos score vs sgrna logfold change for all guides of a given gene
def __format_reagent_plot(gene: Gene):
    """
    Should not have a case where this is NA/there is missing data. All genens in achilles, even if unique_guides = 0, has a value for lfc
    """
    guides = GuideGeneMap.get(gene.entity_id)  # get all genes for a guide
    if guides:
        guides = sorted(guides, key=lambda x: x.num_alignments)

        colors = dict(
            zip(
                [guide.sgrna for guide in guides],
                sns.cubehelix_palette(
                    len(guides), dark=0.2, light=0.6, hue=1, rot=0.73
                ),
            )
        )
        plt.close("all")
        fig, axs = plt.subplots(
            1,
            2,
            gridspec_kw={"width_ratios": [2.5, 1]},
            figsize=(
                9,
                6,
            ),  # determines aspect ratio of the plot and how much space each subplot should take
        )

        gene_effect_achilles_dataset = DependencyDataset.get_dataset_by_name(
            DependencyDataset.DependencyEnum.Chronos_Achilles.name  # gene confidence is chronos_achilles instead of combined, because it uses the sanger dataset to assess confidence in the achilles one
        )
        if gene_effect_achilles_dataset:
            gene_effect_achilles_matrix = gene_effect_achilles_dataset.matrix
            gene_effect_achilles_for_gene = gene_effect_achilles_matrix.get_cell_line_values_and_depmap_ids(
                gene.entity_id
            )

            plt.sca(axs[0])
            guides_data = AchillesLogfoldChange.get_by_sgrnas_and_cell_lines(
                [g.sgrna for g in guides], gene_effect_achilles_for_gene.index
            )
            for i, guide in enumerate(guides):
                sgrna = guide.sgrna
                plt.scatter(
                    gene_effect_achilles_for_gene,
                    guides_data.iloc[i],
                    color=colors[sgrna],
                    alpha=0.6,
                    linewidth=2,
                    label=sgrna,
                )

            plt.xlabel(
                f"{gene.label.split(' ')[0]} {gene_effect_achilles_matrix.units}"
            )
            plt.ylabel("sgRNA Log Fold Change")
            sns.despine()

            # show number of alignments per guide as bar plots
            plt.sca(axs[1])
            sns.despine(bottom=False, left=False)
            plt.xticks([])
            plt.yticks([])
            plt.title("Number Guide Alignments")
            for i, guide in enumerate(guides):
                if i > 8:
                    plt.text(s="More sgRNAs not shown", x=0, y=-0.3 * i)
                    break
                nalign = guide.num_alignments
                plt.text(s=guide.sgrna, x=0, y=-0.3 * i)
                bar = plt.bar(
                    x=0.05,
                    bottom=-0.3 * i - 0.15,
                    height=0.1,
                    width=min(nalign, 12),
                    align="edge",
                    color=colors[guide.sgrna],
                    alpha=0.6,
                    linewidth=20,
                )
                bar[0].set_linewidth(2)
                bar[0].set_edgecolor(colors[guide.sgrna])
                plt.text(s=nalign, x=0.1, y=-0.3 * i - 0.12)

            plt.ylim(-3, 0.1)
            plt.xlim(0, 12)
            plt.tight_layout()
            plt.subplots_adjust(wspace=0.2)
            string_buffer = StringIO()

            plt.savefig(
                string_buffer, format="svg", bbox_inches="tight", pad_inches=0
            )  # transparent true if needed
            plt.close()  # resets the figure, so that the global plot does not build up
            svg = remove_svg_height_width(string_buffer.getvalue())

            return svg

    return None
