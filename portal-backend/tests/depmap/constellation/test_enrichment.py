import os

import numpy as np
import pandas as pd

from depmap.constellation.enrichment import read_genesets, calculate_overrepresentation


def test_calculate_overrepresentation(empty_db_mock_downloads):
    loader_data_dir = os.path.join(
        empty_db_mock_downloads.app.config["LOADER_DATA_DIR"], "constellation"
    )
    hits = pd.read_csv(os.path.join(loader_data_dir, "hits.csv"))
    gene_sets = read_genesets(
        os.path.join(loader_data_dir, "small_gene_sets.csv"), delimiter=","
    )
    expected = pd.read_csv(os.path.join(loader_data_dir, "expected.csv"))

    gene_set_up, gene_set_down = calculate_overrepresentation(hits, gene_sets)
    gene_set_up.reset_index(drop=True, inplace=True)
    gene_set_down.reset_index(drop=True, inplace=True)

    expected = expected.drop(columns=["Unnamed: 0"])
    expected_up = expected[expected["type"] == "gene_set_up"]
    expected_down = expected[expected["type"] == "gene_set_down"].reset_index()

    for col in ["term"]:
        assert (gene_set_up[col] == expected_up[col]).all()
        assert (gene_set_down[col] == expected_down[col]).all()
    for col in ["neg_log_p"]:
        assert (np.abs(gene_set_up[col] - expected_up[col]) < 1e-4).all()
        assert (np.abs(gene_set_down[col] - expected_down[col]) < 1e-4).all()
