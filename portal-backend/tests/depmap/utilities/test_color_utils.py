import pandas as pd
from depmap.utilities import color_utils

from tests.depmap.interactive.fixtures import (
    mutations_dataset_feature,
    mutations_dataset_extra_feature,
    not_in_anything_feature,
)

import pytest


def test_get_mutations_colors(interactive_db_mock_downloads):

    depmap_ids = [
        "ACH-000014",
        "ACH-000052",
        "ACH-000210",
        "ACH-000279",
        "ACH-000304",
        "ACH-000425",
        "ACH-000441",
        "ACH-000458",
        "ACH-000552",
        "ACH-000580",
        "ACH-000585",
        "ACH-000706",
        "ACH-000788",
        "ACH-000805",
        "ACH-000810",
        "ACH-000899",
        "ACH-001001",
        "ACH-001205",
        "ACH-000014",
        "ACH-000052",
        "ACH-000210",
        "ACH-000279",
        "ACH-000304",
        "ACH-000425",
        "ACH-000441",
        "ACH-000458",
        "ACH-000552",
        "ACH-000580",
        "ACH-000585",
        "ACH-000706",
        "ACH-000788",
        "ACH-000805",
        "ACH-000810",
        "ACH-000899",
        "ACH-001001",
        "ACH-001205",
    ]
    color_numbers = [
        0,
        0,
        0,
        0,
        0,
        0,
        2,
        0,
        2,
        3,
        2,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
        2,
        0,
        3,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        4,
        0,
        0,
        0,
    ]

    # Testing for color numbers
    colors_1 = color_utils.get_gene_mutation_colors(mutations_dataset_feature)
    colors_2 = color_utils.get_gene_mutation_colors(mutations_dataset_extra_feature)

    colors = pd.concat([colors_1, colors_2])
    expected_colors = pd.Series(color_numbers, depmap_ids)
    assert colors.equals(expected_colors)

    colors = color_utils.get_gene_mutation_colors(not_in_anything_feature)

    assert colors.equals(
        pd.Series(
            [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0],
            [
                "ACH-000014",
                "ACH-000052",
                "ACH-000210",
                "ACH-000279",
                "ACH-000304",
                "ACH-000425",
                "ACH-000441",
                "ACH-000458",
                "ACH-000552",
                "ACH-000580",
                "ACH-000585",
                "ACH-000706",
                "ACH-000788",
                "ACH-000805",
                "ACH-000810",
                "ACH-000899",
                "ACH-001001",
                "ACH-001205",
            ],
        )
    )
