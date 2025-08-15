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
        print(f"No IsDefaultEntryForModel column found in {dataset_id}, skipping preprocessing")
        return df
    
    print(f"Preprocessing {dataset_id}...")
    print("Filtering to default entries per model...")
    filtered_df = df[df["IsDefaultEntryForModel"] == "Yes"].copy()
    
    assert not filtered_df["ModelID"].duplicated().any(), f"Duplicate ModelID after filtering in {dataset_id}"
    
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
    
    # print("Setting ModelID as index...")
    # filtered_df = filtered_df.set_index("ModelID")
    # filtered_df.index.name = None

    count_all_na_columns = filtered_df.isna().all().sum()
    print(f"Number of columns with ALL NA values: {count_all_na_columns}")
    
    if count_all_na_columns > 0:
        print(f"Data shape before dropping: {filtered_df.shape}")
        print("Dropping columns with all NaN values...")
        filtered_df = filtered_df.dropna(axis=1, how="all")
        print(f"Data shape after dropping: {filtered_df.shape}")
    
    print(f"Finished preprocessing {dataset_id}")
    return filtered_df
