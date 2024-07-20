import pandas as pd
from collections import defaultdict
from typing import Dict, Set, List

from taigapy import create_taiga_client_v3
from utils import update_taiga
from datarelease_taiga_permanames import context_taiga_permaname

column_rename_map = {
    "ModelID": "model_id",
    "OncotreeLineage": "lineage_1",
    "OncotreePrimaryDisease": "lineage_2",
    "OncotreeSubtype": "lineage_3",
}
expected_columns = {"model_id", "lineage_1", "lineage_2", "lineage_3"}

lineage_columns = ["lineage_1", "lineage_2", "lineage_3"]
haematopoietic_and_lymphoid_lineages = ["Lymphoid", "Myeloid"]
non_solid_and_non_haematopoietic_and_lymphoid_lineages = ["Fibroblast", "Normal"]


def model_preprocessing(model_df: pd.DataFrame) -> pd.DataFrame:
    """
    Rename and filter columns, drop duplicates, and ensure unique model IDs.
    """
    model_df.rename(columns=column_rename_map, inplace=True)
    model_df = model_df[list(expected_columns)]
    model_df = model_df[sorted(model_df.columns)]
    model_df.drop_duplicates(inplace=True)

    # Assert uniqueness after dropping duplicates
    if model_df["model_id"].duplicated().any():
        raise ValueError("Model IDs are not unique after dropping duplicates")

    return model_df


def create_lineage_to_cell_lines(
    model_df: pd.DataFrame, lineage_columns: List[str]
) -> Dict[str, Set[str]]:
    """
    Map lineages to sets of cell lines, including special categories.
    """

    lineage_to_cell_lines = defaultdict(lambda: set())

    for lineage_column in lineage_columns:
        for cell_line, lineage in zip(model_df["model_id"], model_df[lineage_column]):
            if not pd.isnull(lineage):
                lineage_to_cell_lines[lineage].add(cell_line)
                if lineage_column == lineage_columns[0]:
                    if lineage in haematopoietic_and_lymphoid_lineages:
                        lineage_to_cell_lines["Haematopoietic_and_Lymphoid"].add(
                            cell_line
                        )
                    elif (
                        lineage
                        not in non_solid_and_non_haematopoietic_and_lymphoid_lineages
                    ):
                        lineage_to_cell_lines["Solid"].add(cell_line)

    return lineage_to_cell_lines


def create_boolean_matrix(
    model_df: pd.DataFrame, lineage_to_cell_lines: Dict[str, Set[str]]
) -> pd.DataFrame:
    """
    Create a boolean matrix representing cell line membership in each lineage.
    """
    unique_model_ids = model_df["model_id"].unique()
    lineage_names = sorted(lineage_to_cell_lines.keys())

    membership_per_lineage = []
    for lineage in lineage_names:
        lineage_cell_lines = lineage_to_cell_lines[lineage]
        membership_per_lineage.append(
            [x in lineage_cell_lines for x in unique_model_ids]
        )

    bool_matrix = pd.DataFrame(
        data=membership_per_lineage, index=lineage_names, columns=unique_model_ids,
    ).astype(float)

    return bool_matrix


def generate_lineage_matrix(model_df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform the input DataFrame to a boolean matrix of cell line membership in lineages.
    """
    model_df = model_preprocessing(model_df)

    # verify that these strings still exist in the data, and that the categorization hasn't changed
    assert all(
        [
            lineage in set(model_df[lineage_columns[0]])
            for lineage in haematopoietic_and_lymphoid_lineages
            + non_solid_and_non_haematopoietic_and_lymphoid_lineages
        ]
    )

    lineage_to_cell_lines = create_lineage_to_cell_lines(model_df, lineage_columns)
    bool_matrix = create_boolean_matrix(model_df, lineage_to_cell_lines)

    return bool_matrix.transpose()


def process_and_update_lineage(source_dataset_id, target_dataset_id):

    """Transform lineage data for predictability and upload it to Taiga."""

    tc = create_taiga_client_v3()

    print("Getting lineage data...")
    model_data = tc.get(f"{source_dataset_id}/{context_taiga_permaname}")

    print("Transforming lineage data...")
    lineage_matrix = generate_lineage_matrix(model_data)
    print("Transformed lineage data")

    update_taiga(
        lineage_matrix,
        "Transform lineage data for predictability",
        target_dataset_id,
        "PredictabilityLineageTransformed",
    )
