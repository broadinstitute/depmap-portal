from flask import url_for, current_app
from json import dumps as json_dumps
import numpy as np
import pandas as pd

from depmap import data_access
from depmap.enums import DataTypeEnum
from depmap.dataset.models import Dataset, BiomarkerDataset
from depmap.cell_line.models import CellLine
from depmap.utilities import color_utils
from depmap.compound import legacy_utils 


# abstracted out here so that tests can import it.
expression_to_size = (
    lambda x: (x + 12) / 1.4
)  # 0 is the expression floor, make 4 the size floor.


class EntitySummaryLegend:
    def __init__(self, legend):
        self.legend = legend


class EntitySummaryMutationLegend(EntitySummaryLegend):
    def __init__(self, color_nums):
        """
        :param color_nums: List of mutation nums to show on legend 
        """
        legend = [
            EntitySummaryMutationLegend.format_legend_entry(num) for num in color_nums
        ]
        super().__init__(legend)

    @staticmethod
    def format_legend_entry(mutation_num):
        return {
            "color": mutation_num,
            "label": color_utils.rna_mutations_color_num_to_category(mutation_num),
        }


class EntitySummaryExpressionLegend(EntitySummaryLegend):
    def __init__(self, expression_to_size, expression_dataset):
        """
        :param expression_to_size: Function that converts expression value to rendered size 
        :param expression_dataset: The expression dataset, to get the max and min
        """
        legend_entries = [
            (expression_dataset.matrix.min, "Low"),
            (expression_dataset.matrix.max, "High"),
            (expression_dataset.matrix.min, "N/A"),
        ]
        legend = {
            "entries": [
                EntitySummaryExpressionLegend.format_legend_entry(
                    expression_to_size, value, label
                )
                for value, label in legend_entries
            ],
            "units": expression_dataset.matrix.units,
        }
        super().__init__(legend)

    @staticmethod
    def format_legend_entry(expression_to_size, value, label):
        return {"diameter": expression_to_size(value), "label": label}


class EntitySummaryCellLinesLegend(EntitySummaryLegend):
    def __init__(self):
        legend = {}
        super().__init__(legend)
        # todo


class EntitySummary:
    def __init__(self, entity, dep_enum, size_biom_enum, color):
        # want these to fail on page render, not ajax cal
        assert size_biom_enum is None or isinstance(
            size_biom_enum, BiomarkerDataset.BiomarkerEnum
        )
        assert (
            color is None
            or color == BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
        )
        self.label = entity.label
        self.entity_id = entity.entity_id
        self.dep_enum = dep_enum
        self.size_biom_enum = size_biom_enum
        self.color = color
        self.type = entity.type
        self.name = (
            entity.entity_id
        )  # some compound experiments have labels with spaces, symbols
        self.strip_url_root = url_for("cell_line.view_cell_line", cell_line_name="")

    def data_for_ajax_partial(self):
        """
        Format to inject variables for the macro
        """
        return {"name": self.name}

    @staticmethod
    def has_size_biom_enum(size_biom_enum, entity_id):
        return size_biom_enum is not None and Dataset.has_entity(
            size_biom_enum, entity_id
        )

    @staticmethod
    def data_for_characterization_partial(
        dataset_enum_name, gene_symbol, gene_id, associated_non_gene_entity=None
    ):
        """
        :associated_non_gene_entity: Used for characterization partials for datasets like RPPA with antibodies for entities. Here, you would pass the antibody object

        This function is a basterdized hack for getting entity summaries in the characterzations tab
        Eventually, this should be deleted, when the entire tab components are moved to react and we can use the normal entity summary
        """
        # manual creation of url for to entity summary. the definintion in the normal entity summary is in api.ts
        ajax_url = url_for(
            "partials.entity_summary_json_data",
            entity_id=gene_id,
            dep_enum_name=dataset_enum_name,
            size_biom_enum_name="none",
            color="none",
        )

        summary = {
            "ajax_url": ajax_url,
            "name": dataset_enum_name + "_" + str(gene_id),
            # this interactive url is different from the one used in full entity summary
            # this version does not autofill
            # it is separate because unlike the entity summary, the toolbar for characterization box plots is created eagerly/not async
            # we thus need it for the template render
            "interactive_url": url_for(
                "data_explorer_2.view_data_explorer_2",
                xDataset=dataset_enum_name,
                xFeature=gene_symbol
                if not associated_non_gene_entity
                else associated_non_gene_entity.label,
                yDataset=None,
                yFeature=None,
            ),
            "download_url": url_for(
                "partials.entity_summary_download",
                entity_id=gene_id,
                dep_enum_name=dataset_enum_name,
                size_biom_enum_name="none",
                color="none",
            ),
        }
        return summary

    def download_data(self):
        """
        Returns the dataframe for the dependency data
        """
        metadata = {}
        legend = {}
        metadata, srs = integrate_dep_data(
            metadata, self.dep_enum.name, self.label, self.entity_id
        )
        df = integrate_cell_line_information(srs)

        df.index.name = "Depmap ID"

        lin1 = (
            df.query("lineage_level == 1")
            .drop(columns=["lineage_level", "lineage_name"])
            .rename(columns={"lineage_display_name": "Lineage"})
        )
        lin2 = (
            df.query("lineage_level == 2")
            .filter(items=["lineage_display_name"])
            .rename(columns={"lineage_display_name": "Lineage Subtype"})
        )
        df = lin1.merge(lin2, how="left", on="Depmap ID")

        if EntitySummary.has_size_biom_enum(self.size_biom_enum, self.entity_id):
            df, legend = integrate_size_and_label_data(
                df, metadata, legend, self.size_biom_enum, self.entity_id
            )
            df = df.drop(columns=["label", "size"]).rename(
                columns={
                    "expression": Dataset.get_dataset_by_name(
                        self.size_biom_enum.name
                    ).display_name,
                }
            )

        if self.color:
            df, legend = integrate_color_data(df, legend, self.color, self.label)
            df["mutation_num"] = df["mutation_num"].map(
                lambda x: color_utils.rna_mutations_color_num_to_category(x)
            )
            df.rename(columns={"mutation_num": self.color.title()}, inplace=True)

        dep_name = Dataset.get_dataset_by_name(self.dep_enum.name).display_name
        df.rename(
            columns={
                "cell_line_display_name": "Cell Line Name",
                "primary_disease": "Primary Disease",
                "value": dep_name,
            },
            inplace=True,
        )
        return df

    def json_data(self):
        """
        1) Assembling the data needed for this plot
            There are three parts to this, because there are three inflection points. There are two datasets where a gene may or may not be present, plus an option of whether to color by mutation
        2) Given this metadata and df, structuring the data as desired by plotly
        """
        metadata = {}
        legend = {}
        metadata, srs = integrate_dep_data(
            metadata, self.dep_enum.name, self.label, self.entity_id
        )
        df = integrate_cell_line_information(srs)
        df, legend = integrate_size_and_label_data(
            df, metadata, legend, self.size_biom_enum, self.entity_id
        )
        df, legend = integrate_color_data(df, legend, self.color, self.label)

        response = {
            "legend": legend,
            "x_range": metadata["x_range"],
            "x_label": metadata["x_label"],
            "description": metadata["description"],
            "interactive_url": metadata["interactive_url"],
            "entity_type": self.type,
        }
        if "line" in metadata:
            response["line"] = metadata["line"]

        # histogram just uses the data from the strip plot
        response["strip"] = format_strip_plot(df, self.strip_url_root)

        return json_dumps(response)


def integrate_dep_data(metadata, dataset_id: str, entity_label: str, entity_id: str):
    """
    Returns:
        x_range, the range the x axis should be displayed at
        series, index is arxspan id and values are dependency scores
    """
    dataset = data_access.get_matrix_dataset(dataset_id)
    dataset_data = data_access.get_subsetted_df_by_labels_compound_friendly(dataset_id)
    data_series = dataset_data.loc[entity_label].dropna()
    data_series.name = "value"

    # Temporary workaround while DE2 still indexes by compound experiment
    if dataset.feature_type == "compound_experiment":
        # If it's indexed by compound experiment, assume it's a legacy dataset
        entity_label = legacy_utils.get_experiment_label_for_compound_label(dataset_id, entity_label)
        assert entity_label is not None, f"Unable to find CompoundExperiment for Compound {entity_id} in dataset {dataset_id}"

    metadata["x_range"] = _get_x_range(data_series)
    metadata["x_label"] = dataset.units
    metadata["interactive_url"] = url_for(
            "data_explorer_2.view_data_explorer_2",
            xDataset=dataset.id,
            xFeature=entity_label,
            yDataset=None,
            yFeature=None,
    )

    if dataset.data_type == DataTypeEnum.crispr.value:
        metadata["description"] = "crispr"
        metadata["line"] = -1
    elif dataset.data_type == DataTypeEnum.rnai.value:
        metadata["description"] = "rnai"
        metadata["line"] = -1
    else:
        metadata["description"] = ""

    return metadata, data_series


def _get_x_range(srs: pd.Series) -> list[float]:
    series_min = float(srs.min()) 
    series_max = float(srs.max())

    return [series_min - 1, series_max + 1]

def integrate_cell_line_information(srs):
    info_to_merge = CellLine.get_cell_line_information_df(srs.index, levels=[1, 2])
    df = pd.merge(srs.to_frame(), info_to_merge, left_index=True, right_index=True)
    return df


def integrate_size_and_label_data(df, metadata, legend, size_biom_enum, entity_id):
    if EntitySummary.has_size_biom_enum(size_biom_enum, entity_id):
        size_dataset = Dataset.get_dataset_by_name(size_biom_enum.name, must=True)
        size = size_dataset.matrix.get_cell_line_values_and_depmap_ids(entity_id)
        df = pd.merge(
            df,
            pd.Series(size).to_frame("expression"),
            how="left",
            left_index=True,
            right_index=True,
        )
        df["size"] = df.apply(lambda row: expression_to_size(row["expression"]), axis=1)
        legend["expression"] = EntitySummaryExpressionLegend(
            expression_to_size, size_dataset
        ).legend
        df["label"] = df.apply(
            lambda row: "<b>{}</b><br>Disease: {}<br>{}: {:.3G}<br>Expression ({}): {:.3G}".format(
                row["cell_line_display_name"],
                row["primary_disease"],
                metadata["x_label"],
                row["value"],
                size_dataset.matrix.units,
                row["expression"],
            ),
            axis=1,
        )

    else:
        df = pd.merge(
            df,
            pd.Series(dtype="float64").to_frame("size"),
            how="left",
            left_index=True,
            right_index=True,
        )
        df["size"].fillna(expression_to_size(0), inplace=True)
        df["label"] = df.apply(
            lambda row: "<b>{}</b><br>Disease: {}<br>{}: {:.3G}".format(
                row["cell_line_display_name"],
                row["primary_disease"],
                metadata["x_label"],
                row["value"],
            ),
            axis=1,
        )

    return df, legend


def integrate_color_data(df, legend, color, label):
    if color == BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name:
        if BiomarkerDataset.has_entity(
            BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name,
            entity=label,
            by_label=True,
        ):
            mutations = color_utils.get_gene_mutation_colors(label=label)
            all_colors = color_utils.get_all_mutation_colors_except_0()
            df = pd.merge(
                df,
                mutations.to_frame("mutation_num"),
                how="left",
                left_index=True,
                right_index=True,
            )

            df["mutation_num"].fillna(0, inplace=True)
            if len(mutations) > 0:
                df = df.sort_values(
                    ["mutation_num"]
                )  # sort by color number ascending, then use a stable sort later
                legend["mutation"] = EntitySummaryMutationLegend(
                    sorted(all_colors, reverse=True)
                ).legend
                # the above is fine because we don't include highlights in the legend color
        else:
            df["mutation_num"] = 0
    else:
        df["mutation_num"] = 0

    return df, legend


def format_strip_plot(df, strip_url_root):
    # Was previously sorted by color ascending
    # Now sort by summary type descending by mean (since plotly draws bottom to top)
    # use mergesort in df.sort_values for a stable sort

    # add a column for level 1 lineage
    cell_line_to_level_1_lineage = df[df["lineage_level"] == 1]["lineage_display_name"]
    df["level_1_lineage_display_name"] = df.apply(
        lambda row: cell_line_to_level_1_lineage[row.name], axis=1
    )

    # compute number of lines per lineage and sub-lineage
    df["depmap_id"] = df.index
    df = df.reset_index(drop=True)  # drop the index
    df = df.groupby("lineage_display_name").apply(
        lambda df: df.assign(num_lines=len(df))
    )
    df = df.reset_index(drop=True)  # drop the multiindex from the groupby

    # generate traces, in order of level 1 lineage
    traces = []
    for lineage_1, lineage_df in df.groupby("level_1_lineage_display_name"):
        for lineage_display_name, trace_df in lineage_df.groupby(
            ["lineage_level", "lineage_display_name"]
        ):
            traces.append(
                {
                    "data": {
                        "depmap_id": trace_df.depmap_id.tolist(),
                        # depmap id is duplicated here for convenience. Other fields like lineage and primary disease are not needed by the javascript code, as they are already encoded in the hover text
                        "cell_line_information": trace_df[
                            ["depmap_id", "cell_line_display_name"]
                        ].to_dict("records"),
                        "label": trace_df.label.tolist(),
                        "value": trace_df.value.tolist(),
                        "size": [None if np.isnan(v) else v for v in trace_df["size"]],
                        "mutation_num": trace_df.mutation_num.tolist(),
                    },
                    "category": trace_df.lineage_display_name.iloc[0],
                    "lineage_level": trace_df.lineage_level.iloc[
                        0
                    ].item(),  # convert from numpy dtypes to normal python types
                    "num_lines": trace_df.num_lines.iloc[
                        0
                    ].item(),  # convert from numpy dtypes to normal python types
                }
            )

    return {"url_root": strip_url_root, "traces": traces}
