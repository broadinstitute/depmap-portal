import argparse
import sqlite3
import sys
import numpy as np
import pandas as pd

sys.path.append(".")
from hdf5_utils import read_hdf5

LIMIT = 100
MIN_NUMBER_OF_POINTS = 30


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("in_hdf5_0")
    parser.add_argument("in_hdf5_1")
    parser.add_argument("--label0")
    parser.add_argument("--label1")
    parser.add_argument("--batchsize", type=int, default=500)
    parser.add_argument("--drop-sparse-columns", type=int, default=None)
    parser.add_argument("output_file")

    args = parser.parse_args()

    in_hdf5_0_df = read_hdf5(args.in_hdf5_0)
    in_hdf5_1_df = read_hdf5(args.in_hdf5_1)

    dataset_0_labels = labels_to_df(in_hdf5_0_df.index)
    dataset_1_labels = labels_to_df(in_hdf5_1_df.index)

    in_hdf5_0_df = in_hdf5_0_df.transpose()
    in_hdf5_1_df = in_hdf5_1_df.transpose()  # initially, cell lines are columns

    if args.drop_sparse_columns is not None:
        # drop any columns where we don't have a sufficient number of non NA values
        in_hdf5_0_df = drop_sparse_columns(in_hdf5_0_df, args.drop_sparse_columns)
        in_hdf5_1_df = drop_sparse_columns(in_hdf5_1_df, args.drop_sparse_columns)

    in_hdf5_0_df, in_hdf5_1_df = with_shared_cell_lines(in_hdf5_0_df, in_hdf5_1_df)
    correlations_df = create_correlations_df(in_hdf5_0_df, in_hdf5_1_df, args.batchsize)

    conn = sqlite3.connect(args.output_file)
    correlations_df.to_sql("correlation", conn, if_exists="replace", index=False)
    dataset_0_labels.to_sql(
        "dim_0_label_position", conn, if_exists="replace", index=False
    )
    dataset_1_labels.to_sql(
        "dim_1_label_position", conn, if_exists="replace", index=False
    )
    pd.DataFrame(
        dict(
            dataset=[0, 1],
            filename=[args.in_hdf5_0, args.in_hdf5_1],
            label=[args.label0, args.label1],
        )
    ).to_sql("dataset", conn, if_exists="replace", index=False)
    conn.execute(
        "CREATE INDEX dim_0_label_position_idx_1 ON dim_0_label_position (label)"
    )
    conn.execute(
        "CREATE INDEX dim_0_label_position_idx_2 ON dim_0_label_position (position)"
    )
    conn.execute(
        "CREATE INDEX dim_1_label_position_idx_1 ON dim_1_label_position (label)"
    )
    conn.execute(
        "CREATE INDEX dim_1_label_position_idx_2 ON dim_1_label_position (position)"
    )
    conn.execute("CREATE INDEX correlation_idx_1 ON correlation (dim_1, cor)")
    conn.execute("CREATE INDEX correlation_idx_0 ON correlation (dim_0, cor)")
    c = conn.cursor()
    c.execute(
        "select count(1) from (select dim_0, dim_1, count(1) from correlation group by dim_0, dim_1 having count(1) > 1)"
    )
    rec = c.fetchone()
    assert rec[0] == 0, "Found {} dups".format(rec[0])
    c.close()


def drop_sparse_columns(df, min_samples):
    # drop any columns which have fewer than min_samples with non-NA values
    col_mask = (~df.isna()).apply(sum) > min_samples
    print(
        f"dropping {col_mask[~col_mask].index} columns which have < {min_samples} non-NA samples"
    )
    return ge25q3.loc[:, col_mask].copy()


def labels_to_df(labels):
    return pd.DataFrame(dict(label=labels, position=list(range(len(labels)))))


def with_shared_cell_lines(dep_df, biomarker_df):
    shared_cell_lines = np.intersect1d(dep_df.index, biomarker_df.index)
    dep_df = dep_df.loc[shared_cell_lines]
    biomarker_df = biomarker_df.loc[shared_cell_lines]
    return dep_df, biomarker_df


def create_correlations_df(dep_df, biomarker_df, batchsize):
    # assumes rows have already been aligned
    biomarker_df.columns = list(range(len(biomarker_df.columns)))
    partial_dfs = [
        create_correlations_df_partial(dep_df, biomarker_df_partial)
        # for slices of 500 columns at a time from biomarker_df
        for _, biomarker_df_partial in biomarker_df.groupby(
            np.arange(len(biomarker_df.columns)) // batchsize, axis=1
        )
    ]

    return concat_dfs_and_filter(partial_dfs)


def create_correlations_df_partial(dep_df, biomarker_df_partial):
    correlations = fast_cor_with_missing(dep_df.values, biomarker_df_partial.values)
    (
        top_ranked_cols_per_row,
        top_ranked_rows_per_col,
        row_indexes,
        col_indexes,
    ) = top_ranked_indexes_per_row_and_col(-np.abs(correlations))

    df = pd.DataFrame(
        {
            "cor": np.hstack(
                (
                    correlations[row_indexes, top_ranked_cols_per_row],
                    correlations[top_ranked_rows_per_col, col_indexes],
                )
            ),
            "dim_0": list(row_indexes) + list(top_ranked_rows_per_col),
            "dim_1": biomarker_df_partial.columns[
                list(top_ranked_cols_per_row) + list(col_indexes)
            ],
        },
        columns=["dim_0", "dim_1", "cor"],
    )
    return df.drop_duplicates(["dim_0", "dim_1"])


def top_ranked_indexes_per_row_and_col(matrix):
    """Gets the coordinates for the largest `LIMIT` values, by row and by column."""
    num_rows, num_cols = matrix.shape
    limit_per_col = min(num_rows, LIMIT)
    limit_per_row = min(num_cols, LIMIT)

    top_ranked_cols_per_row = np.argpartition(matrix, limit_per_row - 1, axis=1)[
        :, :limit_per_row
    ].flatten()
    top_ranked_rows_per_col = np.argpartition(matrix, limit_per_col - 1, axis=0)[
        :limit_per_col
    ].flatten()

    row_indexes = np.repeat(range(num_rows), limit_per_row)
    col_indexes = np.tile(range(num_cols), limit_per_col)

    return top_ranked_cols_per_row, top_ranked_rows_per_col, row_indexes, col_indexes


def fast_cor_with_missing(x, y):
    # preallocate storage for the result
    result = np.zeros(shape=(x.shape[1], y.shape[1]))

    x_groups = group_cols_with_same_mask(x)
    y_groups = group_cols_with_same_mask(y)
    for x_mask, x_columns in x_groups:
        for y_mask, y_columns in y_groups:
            # print(x_mask, x_columns, y_mask, y_columns)
            combined_mask = x_mask & y_mask
            number_of_points = np.sum(combined_mask)
            if number_of_points < MIN_NUMBER_OF_POINTS:
                # skip computing the correlation for these pairs, but just record that we've got a
                # hole by storing NA in the result matrix
                result[np.ix_(x_columns, y_columns)] = np.nan
            else:
                # not sure if this is the fastest way to slice out the relevant subset
                x_without_holes = x[:, x_columns][combined_mask, :]
                y_without_holes = y[:, y_columns][combined_mask, :]

                c = np_pearson_cor(x_without_holes, y_without_holes)
                # update result with these correlations
                result[np.ix_(x_columns, y_columns)] = c
    return result


def group_cols_with_same_mask(x):
    """
    Group columns with the same indexes of NAN values.
    
    Return a sequence of tuples (mask, columns) where columns are the column indices
    in x which all have the mask.
    """
    per_mask = {}
    for i in range(x.shape[1]):
        o_mask = np.isfinite(x[:, i])
        o_mask_b = np.packbits(o_mask).tobytes()
        if o_mask_b not in per_mask:
            per_mask[o_mask_b] = [o_mask, []]
        per_mask[o_mask_b][1].append(i)
    return per_mask.values()


def np_pearson_cor(x, y):
    """Full column-wise Pearson correlations of two matrices."""
    xv = x - x.mean(axis=0)
    yv = y - y.mean(axis=0)
    xvss = (xv * xv).sum(axis=0)
    yvss = (yv * yv).sum(axis=0)
    # print(xvss, yvss)
    # print(np.matmul(xv.transpose(), yv) , np.sqrt(np.outer(xvss, yvss)))
    result = np.matmul(xv.transpose(), yv) / np.sqrt(np.outer(xvss, yvss))
    return np.maximum(np.minimum(result, 1.0), -1.0)


def concat_dfs_and_filter(dfs):
    df = pd.concat(dfs, ignore_index=True, sort=False)
    df["cor_abs"] = df["cor"].abs()
    df["dim_0_rank"] = df.groupby("dim_1")["cor_abs"].rank(ascending=False)
    df["dim_1_rank"] = df.groupby("dim_0")["cor_abs"].rank(ascending=False)
    df = df[(df["dim_0_rank"] <= LIMIT) | (df["dim_1_rank"] <= LIMIT)]
    del df["cor_abs"]
    del df["dim_0_rank"]
    del df["dim_1_rank"]
    return df


if __name__ == "__main__":
    main()
