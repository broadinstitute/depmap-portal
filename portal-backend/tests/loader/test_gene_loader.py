import pandas as pd
import numpy as np
from loader import gene_loader


def test_merge_gene_executive_info():
    """
    Test that
        if a gene is in rnai, not in avana, and has dropped by chronos true, it should get two entries (the dropped by chronos should not merge into the rnai one)
    """
    dep_summary = pd.DataFrame(
        [
            [100, "crispr", 3, 13, True, False],  # extra row
            [
                111,
                "crispr",
                0,
                23,
                False,
                False,
            ],  # should merge with dropped by chronos, e.g. a gene not in avana (avana is the default crispr enum) that was recovered in chronos
            [
                222,
                "rnai",
                0,
                123,
                False,
                False,
            ],  # normal rnai entry with no crispr or dropped from chronos
            [
                333,
                "rnai",
                0,
                123,
                False,
                False,
            ],  # this rnai entry should not merge, e.g. a gene in rnai but has reasons for not being in crispr
        ],
        columns=[
            "entrez_id",
            "dataset",
            "dep_lines",
            "lines_with_data",
            "is_strongly_selective",
            "is_common_essential",
        ],
    )
    dropped_by_chronos = pd.DataFrame(
        [[333, "crispr", True], [444, "crispr", True],],  # also in rnai  # not in rnai
        columns=["entrez_id", "dataset", "is_dropped_by_chronos"],
    )
    expected_df = pd.DataFrame(
        [
            [100, "crispr", 3, 13, True, False, np.NaN],
            [111, "crispr", 0, 23, False, False, np.NaN],
            [222, "rnai", 0, 123, False, False, np.NaN],
            [333, "rnai", 0, 123, False, False, np.NaN],
            [333, "crispr", np.NaN, np.NaN, np.NaN, np.NaN, True],
            [444, "crispr", np.NaN, np.NaN, np.NaN, np.NaN, True],
        ],
        columns=[
            "entrez_id",
            "dataset",
            "dep_lines",
            "lines_with_data",
            "is_strongly_selective",
            "is_common_essential",
            "is_dropped_by_chronos",
        ],
    )
    expected_df = expected_df.astype({"entrez_id": "str"})

    merged_gene_executive_info = gene_loader._merge_gene_executive_info(
        dep_summary, dropped_by_chronos
    )
    assert merged_gene_executive_info.equals(expected_df)
