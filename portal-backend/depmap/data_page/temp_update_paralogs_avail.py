from depmap import data_access
import pandas as pd


def get_paralogs_summary():
    paralogs_df = data_access.get_subsetted_df_by_labels("paralogs_25q2")

    # The data_access interface returns a transposed matrix, so let's transpose it back before reseting the index
    paralogs = paralogs_df.T.reset_index(names=["ModelID"])

    paralogs_summary = (
        paralogs[["ModelID"]]
        .assign(CRISPR_ParalogsScreens=True)
        .drop_duplicates()
        .set_index("ModelID")
    )

    return paralogs_summary


def update_paralogs_avail(overall_summary: pd.DataFrame):
    # 1. Get the fresh, "correct" source of truth
    paralogs_summary = get_paralogs_summary()
    assert paralogs_summary.index.is_unique

    target_col = "CRISPR_ParalogsScreens"

    # 2. Reset the column to all False first to "delete" existing data
    # This ensures that even if the new summary is missing some ModelIDs
    # that were previously 'True', they are correctly wiped out.
    overall_summary[target_col] = False

    # 3. Align the new data to the existing overall_summary index
    valid_ids = paralogs_summary.index.intersection(overall_summary.index)

    overall_summary.loc[valid_ids, target_col] = paralogs_summary.loc[
        valid_ids, target_col
    ]

    # 4. Final cast to ensure boolean type
    overall_summary[target_col] = overall_summary[target_col].astype(bool)

    return overall_summary
