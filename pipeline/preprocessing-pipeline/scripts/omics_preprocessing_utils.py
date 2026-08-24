import pandas as pd


def preprocess_omics_dataframe(df, dataset_id):
    """
    Preprocesses Omics dataframes with standard filtering steps:
    1. Filter to default entries per model (IsDefaultEntryForModel == "Yes")
    2. Assert no duplicate ModelID after filtering
    3. Drop metadata columns
    4. Set ModelID as index
    5. Drop columns with all NaN values
    """

    # Check if this dataframe needs preprocessing (has the required columns)
    if "IsDefaultEntryForModel" not in df.columns:
        print(
            f"No IsDefaultEntryForModel column found in {dataset_id}, skipping preprocessing"
        )
        return df

    print(f"Preprocessing {dataset_id}...")
    print("Filtering to default entries per model...")
    filtered_df = df[df["IsDefaultEntryForModel"] == "Yes"].convert_dtypes().copy()

    print("Dropping some metadata columns...")
    cols_to_drop = [
        "SequencingID",
        "ModelConditionID",
        "IsDefaultEntryForModel",
        "IsDefaultEntryForMC",
    ]
    existing_cols_to_drop = [c for c in cols_to_drop if c in filtered_df.columns]
    if existing_cols_to_drop:
        filtered_df = filtered_df.drop(columns=existing_cols_to_drop)

    dataset_name = dataset_id.split("/")[-1]
    if dataset_name in [
        "OmicsFusionFiltered",
        "OmicsProfiles",
        "OmicsSomaticMutations",
    ]:
        print(f"Warning: {dataset_id} has multiple entries per ModelID")
    else:

        # this is collapse step is too slow for big matrices, so just test to see if we have a case where we need it
        if dataset_name in ["OmicsGlobalSignatures"]:

            def collapse_nas(values):
                values = values.dropna()
                if len(values) > 1:
                    raise ValueError(
                        f"Expected at most one non-NA values but got: {values}"
                    )
                if len(values) == 0:
                    return pd.NA
                return values

            filtered_df = filtered_df.groupby("ModelID", as_index=False).agg(
                collapse_nas
            )
            assert isinstance(filtered_df, pd.DataFrame)

        assert (
            not filtered_df["ModelID"].duplicated().any()
        ), f"Duplicate ModelID after filtering in {dataset_id}"
        print("Setting ModelID as index...")
        filtered_df = filtered_df.set_index("ModelID")
        filtered_df.index.name = None

        filtered_df = filtered_df.astype("Float32")
        print("Columns in ds: ", set(filtered_df.dtypes))

    count_all_na_columns = filtered_df.isna().all().sum()
    print(f"Number of columns with ALL NA values: {count_all_na_columns}")

    if count_all_na_columns > 0:
        print(f"Data shape before dropping: {filtered_df.shape}")
        print("Dropping columns with all NaN values...")
        filtered_df = filtered_df.dropna(axis=1, how="all")
        print(f"Data shape after dropping: {filtered_df.shape}")

    print(f"Finished preprocessing {dataset_id}")
    print("returning Columns in ds: ", set(filtered_df.dtypes))
    return filtered_df
