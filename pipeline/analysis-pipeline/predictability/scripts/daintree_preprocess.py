import pandas as pd

columns_to_drop = [
    "SequencingID",
    "ModelConditionID",
    "IsDefaultEntryForModel",
    "IsDefaultEntryForMC",
]


def assert_index_looks_like_model_ids(df):
    for x in df.index:
        try:
            assert x.startswith("ACH-"), f"Expected ModelID but got {x}"
        except:
            print("Problem with this matrix")
            print(df)
            raise


def collapse_nas(values):
    values = values.dropna()
    if len(values) > 1:
        raise ValueError(f"Expected at most one non-NA values but got: {values}")
    if len(values) == 0:
        return pd.NA
    return values


def index_by_model(df):
    print("calling index_by_model on df:")
    print(df)

    if "IsDefaultEntryForModel" in df:
        print("Detected matrix which needs filtering to ModelID")
        df = df[df["IsDefaultEntryForModel"] == "Yes"]
        df = df.drop(columns=columns_to_drop).copy()
        if len(df.columns) < 100:
            # this is slow on large dataframes, so only run it if we really need to (GenomicsSignatures which only has 11 columns)
            df = df.groupby("ModelID", as_index=False).agg(collapse_nas)
        df = df.set_index("ModelID")

        assert sum(df.index.duplicated()) == 0

    assert_index_looks_like_model_ids(df)
    return df


def drop_sparse_columns(df):
    # starting in 26Q1, the dep matrix started having some genes with ~4 non-na samples. This caused the k-fold validation to
    # crash in cds-ensemble. To avoid that whole headache, drop any targets which have fewer then 20 samples.
    print("calling drop_sparse_columns on data frame:")
    print(df)

    non_nans_per_column = df.apply(lambda x: (~x.isna()).sum())
    columns_to_drop = non_nans_per_column < 20
    assert sum(columns_to_drop) / len(columns_to_drop) < 0.01
    print(f"Dropping {sum(columns_to_drop)} columns")
    df = df.loc[:, df.columns[~columns_to_drop]]

    assert_index_looks_like_model_ids(df)
    return df.copy()
