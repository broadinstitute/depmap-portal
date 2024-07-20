from collections import defaultdict
import pandas as pd
from depmap.utilities.hashing_utils import hash_df


def test_hash_df():
    """
    Test that for each df with changes in
        value of contents
        content type
        row name
        row order
        column name
        column order
    1) The are all deterministic, that is creating another df with the same specifications produces the same hash
    2) They result in different hashes
    """

    hash_to_df = defaultdict(lambda: [])

    df1 = pd.DataFrame([1, 2], ["row1", "row2"], ["col"])
    df1_hash = hash_df(df1)
    assert df1_hash == hash_df(pd.DataFrame([1, 2], ["row1", "row2"], ["col"]))
    hash_to_df[df1_hash].append(df1)

    # change contents value
    df2 = pd.DataFrame([1, 1], ["row1", "row2"], ["col"])
    df2_hash = hash_df(df2)
    assert df2_hash == hash_df(pd.DataFrame([1, 1], ["row1", "row2"], ["col"]))
    hash_to_df[df2_hash].append(df2)

    # change row name
    df3 = pd.DataFrame([1, 2], ["row1", "diff"], ["col"])
    df3_hash = hash_df(df3)
    assert df3_hash == hash_df(pd.DataFrame([1, 2], ["row1", "diff"], ["col"]))
    hash_to_df[df3_hash].append(df3)

    # change row order
    df4 = pd.DataFrame([2, 1], ["row2", "row1"], ["col"])
    df4_hash = hash_df(df4)
    assert df4_hash == hash_df(pd.DataFrame([2, 1], ["row2", "row1"], ["col"]))
    hash_to_df[df4_hash].append(df4)

    # change col name
    df5 = pd.DataFrame([1, 2], ["row1", "row2"], ["diff"])
    df5_hash = hash_df(df5)
    assert df5_hash == hash_df(pd.DataFrame([1, 2], ["row1", "row2"], ["diff"]))
    hash_to_df[df5_hash].append(df5)

    # with two cols, one row
    df6 = pd.DataFrame({"col1": [1], "col2": [2]}, ["row"], ["col1", "col2"])
    df6_hash = hash_df(df6)
    assert df6_hash == hash_df(
        pd.DataFrame({"col1": [1], "col2": [2]}, ["row"], ["col1", "col2"])
    )
    hash_to_df[df6_hash].append(df6)

    # change col order
    df7 = pd.DataFrame({"col1": [1], "col2": [2]}, ["row"], ["col2", "col1"])
    df7_hash = hash_df(df7)
    assert df7_hash == hash_df(
        pd.DataFrame({"col1": [1], "col2": [2]}, ["row"], ["col2", "col1"])
    )
    hash_to_df[df7_hash].append(df7)

    for hash, dfs in hash_to_df.items():
        assert len(dfs) == 1, "The follow dataframes have the same hash:\n{}".format(
            "\n".join([df.to_string() for df in dfs])
        )
