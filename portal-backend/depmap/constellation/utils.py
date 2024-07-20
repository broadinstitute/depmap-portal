import enum
import os
from dataclasses import dataclass
from typing import Dict

import numpy as np
import pandas as pd
from flask import current_app
from celery import states as celery_states
from celery.result import AsyncResult

from depmap.compute.celery import app
from depmap.constellation.enrichment import (
    Geneset,
    calculate_overrepresentation,
    read_genesets,
)

TAIGA_DATASET_VERSION = "constellation-files-dc5d.10/"

DIR = "constellation"
GENE_SETS_FILE = os.path.join(DIR, "gene_sets.csv")
CODEP_FILE = os.path.join(DIR, "codep.csv")
EXPRESSION_FILE = os.path.join(DIR, "expressions.csv")
MSIGDB_FILE = os.path.join(DIR, "msigdb.csv")
STRING_EXPERIMENTAL_FILE = os.path.join(DIR, "string_experimental_db.csv")
STRING_TEXT_FILE = os.path.join(DIR, "string_text_db.csv")
STRING_COMBINED_FILE = os.path.join(DIR, "string_combined_db.csv")
DEPMAP_COR_FILE = os.path.join(DIR, "depmap_cor.csv")
BIOPLEX_FILE = os.path.join(DIR, "bioplex.csv")


class ConnectivityOption(enum.Enum):
    high = 3
    medium = 2
    low = 1


class SimilarityOption(enum.Enum):
    codependency = (
        "codependency",
        "CRISPR (Avana) Codependency",
        CODEP_FILE,
        TAIGA_DATASET_VERSION + "achilles_edges",
    )
    expression = (
        "expression",
        "CCLE Coexpression",
        EXPRESSION_FILE,
        TAIGA_DATASET_VERSION + "expression_edges",
    )
    misgdb = (
        "misgdb",
        "MSigDB Curated Pathways",
        MSIGDB_FILE,
        TAIGA_DATASET_VERSION + "msigdb_edges",
    )
    string_db_experimental = (
        "string_db_experimental",
        "STRING PPi",
        STRING_EXPERIMENTAL_FILE,
        TAIGA_DATASET_VERSION + "experimental_edges",
    )
    string_db_textmining = (
        "string_db_textmining",
        "STRING Literature",
        STRING_TEXT_FILE,
        TAIGA_DATASET_VERSION + "text_edges",
    )
    string_db_combined = (
        "string_db_combined",
        "STRING All",
        STRING_COMBINED_FILE,
        TAIGA_DATASET_VERSION + "combined_edges",
    )
    depmap_cor = (
        "depmap_cor",
        "Feature Correlation",
        DEPMAP_COR_FILE,
        TAIGA_DATASET_VERSION + "depmap_cor_edges",
    )
    bioplex = (
        "bioplex",
        "BioPlex 293T Cells",
        BIOPLEX_FILE,
        TAIGA_DATASET_VERSION + "bioplex_edges",
    )

    def __init__(self, option_id: str, label: str, file: str, taiga_id: str):
        self.option_id = option_id
        self.label = label
        self.file = file
        self.taiga_id = taiga_id

    @classmethod
    def get_by_option_id(cls, option_id: str) -> "SimilarityOption":
        return next(
            similarity_option
            for similarity_option in cls
            if similarity_option.option_id == option_id
        )


class TopFeatureEnum(enum.Enum):
    """
    String values match the expected column name from rename_columns()
    """

    abs_correlation = "absolute_correlation"
    max_correlation = "max_correlation"
    min_correlation = "min_correlation"
    neg_log_p = "-log10(P)"


def get_df_from_task_id(task_id: str) -> pd.DataFrame:
    """
    Get the task results, and transform p value to -log10(P)
    """
    task = AsyncResult(task_id, app=app)
    if task.state == celery_states.SUCCESS:
        data_json_file_path = task.result["data_json_file_path"]
        df = pd.read_json(data_json_file_path)
        df["-log10(P)"] = -df["PValue"].apply(np.log10)
        df["task"] = task_id
        return df
    return None


def select_n_features(
    feature_effects: pd.DataFrame,
    n: int,
    top_selected_feature: TopFeatureEnum,
    is_depmap_cor: bool,
):
    """Given the top_selected_feature to sort by, returns n features, by selecting top sorted effect sizes or negative log pvalue."""
    top_selected_feature_to_sort_key: Dict[str, dict] = {
        TopFeatureEnum.abs_correlation.value: {
            "col": "effect",
            "key": lambda col: col.abs(),
            "ascending": False,
        },
        TopFeatureEnum.max_correlation.value: {
            "col": "effect",
            "key": None,
            "ascending": False,
        },
        TopFeatureEnum.min_correlation.value: {
            "col": "effect",
            "key": None,
            "ascending": True,
        },
        TopFeatureEnum.neg_log_p.value: {
            "col": TopFeatureEnum.neg_log_p.value,
            "key": None,
            "ascending": False,
        },
    }

    column = top_selected_feature_to_sort_key[top_selected_feature.value]["col"]
    key = top_selected_feature_to_sort_key[top_selected_feature.value]["key"]
    ascending = top_selected_feature_to_sort_key[top_selected_feature.value][
        "ascending"
    ]
    features = feature_effects.sort_values(by=column, key=key, ascending=ascending,)[:n]
    # We deduplicate for the visualization of graph definitions table via the network plot
    # Since df sorted earlier, should keep feature with highest absolute effect
    # If similarity option is depmap correlation, don't remove duplicate features
    # because features are different by dataset they are in
    if not is_depmap_cor:
        features = remove_duplicated_features(features)
    return features.reset_index()


def rename_columns(input_df: pd.DataFrame) -> pd.DataFrame:
    required_columns_and_alternatives = {
        "feature": {"gene", "genes", "feature", "label"},
        "effect": {"effect", "correlation", "cor", "logfc"},
        TopFeatureEnum.neg_log_p.value: {
            "-log10(p)",
            "-log10(lmpvalue)",
            "-log10(pvalue)",
            "-log10(p-value)",
            "logp",
        },
    }

    for required_col, alternatives in required_columns_and_alternatives.items():
        columns = input_df.columns.to_list()
        if required_col in columns:
            continue

        col = next((col for col in columns if col.lower() in alternatives), None,)

        if col is not None:
            input_df.rename(columns={col: required_col}, inplace=True)
            continue

        if required_col == "effect":
            col = next((col for col in columns if "effect" in col.lower()), None)

            if col is not None:
                input_df.rename(columns={col: required_col}, inplace=True)
                continue

        if required_col == "-log10(P)":
            # If -log10(P) not available, try finding p value and calculate -log10(P)
            col = next(
                (
                    col
                    for col in columns
                    if col.lower()
                    in {
                        "lmpvalue",
                        "adj.p.val",
                        "pvalue",
                        "p.value",
                        "pval",
                        "p_value",
                    }
                ),
                None,
            )

            if col is not None:
                input_df[required_col] = -input_df[col].apply(np.log10)
                continue

    missing_columns = {"feature", "effect", "-log10(P)"} - set(input_df.columns)
    if len(missing_columns) > 0:
        raise ValueError("Input file missing columns: {}".format(missing_columns))
    return input_df


def add_geneset_positions(df: pd.DataFrame, nodes):
    x = []
    y = []

    for _, row in df.iterrows():
        nodes_in_geneset = [node for node in nodes if row["term"] in node["gene_sets"]]
        if len(nodes_in_geneset) == 0:
            x.append(0)
            y.append(0)
        else:
            x.append(np.median([node["x"] for node in nodes_in_geneset]))
            y.append(np.median([node["y"] for node in nodes_in_geneset]))

    df["x"] = x
    df["y"] = y


def remove_duplicated_features(df: pd.DataFrame):
    """Given a dataframe sorted by gene names. if there are duplicate genes, drop duplicate """
    deduplicated_df = df.drop_duplicates(["feature"])
    return deduplicated_df
