import argparse
import sqlite3
import sys
import numpy as np
import pandas as pd
import taigapy
from taigapy.client_v3 import LocalFormat
from tqdm import tqdm

sys.path.append(".")
from hdf5_utils import read_hdf5
from cor_table_packer import write_cor_df


def _get_prefixed(prefix, name):
    if name.startswith(prefix):
        return name[len(prefix) :]
    return None


def read_input(name):
    taiga_id = _get_prefixed("taiga:", name)
    if taiga_id is not None:
        tc = taigapy.create_taiga_client_v3()
        fn = tc.download_to_cache(taiga_id, LocalFormat.HDF5_MATRIX)
    else:
        fn = name

    return read_hdf5(fn)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("in_hdf5_0")
    parser.add_argument("in_hdf5_1")
    parser.add_argument("--label0")
    parser.add_argument("--label1")
    #    parser.add_argument("--add-count", action="store_true", dest="add_count")
    parser.add_argument("--minsamples", type=int, default=30)
    parser.add_argument("--batchsize", type=int, default=500)
    parser.add_argument("--limit", type=int, default=250)
    parser.add_argument("--limit-per-sign", type=int, default=25, dest="limit_per_sign")
    parser.add_argument("--no-transpose", action="store_false", dest="transpose")
    parser.add_argument("output_file")

    args = parser.parse_args()

    in_hdf5_0_df = read_input(args.in_hdf5_0)
    label_0 = args.label0 if args.label0 else args.in_hdf5_0

    in_hdf5_1_df = read_input(args.in_hdf5_1)
    label_1 = args.label1 if args.label1 else args.in_hdf5_1

    if args.transpose:
        in_hdf5_0_df = in_hdf5_0_df.transpose()
        in_hdf5_1_df = in_hdf5_1_df.transpose()  # initially, cell lines are columns

    # dataset_0_labels = labels_to_df(in_hdf5_0_df.columns)
    # dataset_1_labels = labels_to_df(in_hdf5_1_df.columns)

    in_hdf5_0_df, in_hdf5_1_df = with_shared_cell_lines(in_hdf5_0_df, in_hdf5_1_df)
    # if we don't have a lot of samples shared, something is wrong
    assert len(in_hdf5_0_df) > 10
    assert len(in_hdf5_1_df) == len(in_hdf5_0_df)
    correlations_df = create_correlations_df(
        in_hdf5_0_df,
        in_hdf5_1_df,
        args.batchsize,
        args.limit,
        args.minsamples,
        args.limit_per_sign,
    )
    correlations_df = correlations_df[["dim_0", "dim_1", "cor", "qvalue"]]

    print(f"Writing to {args.output_file}")
    write_cor_df(correlations_df, args.output_file)

    # conn = sqlite3.connect(args.output_file)
    # correlations_df.to_sql("correlation", conn, if_exists="replace", index=False)
    # dataset_0_labels.to_sql(
    #     "dim_0_label_position", conn, if_exists="replace", index=False
    # )
    # dataset_1_labels.to_sql(
    #     "dim_1_label_position", conn, if_exists="replace", index=False
    # )
    # pd.DataFrame(
    #     dict(
    #         dataset=[0, 1],
    #         filename=[args.in_hdf5_0, args.in_hdf5_1],
    #         label=[label_0, label_1],
    #     )
    # ).to_sql("dataset", conn, if_exists="replace", index=False)

    # print(f"Building indices...")
    # conn.execute(
    #     "CREATE INDEX dim_0_label_position_idx_1 ON dim_0_label_position (label)"
    # )
    # conn.execute(
    #     "CREATE INDEX dim_0_label_position_idx_2 ON dim_0_label_position (position)"
    # )
    # conn.execute(
    #     "CREATE INDEX dim_1_label_position_idx_1 ON dim_1_label_position (label)"
    # )
    # conn.execute(
    #     "CREATE INDEX dim_1_label_position_idx_2 ON dim_1_label_position (position)"
    # )
    # conn.execute("CREATE INDEX correlation_idx_1 ON correlation (dim_1, cor)")
    # conn.execute("CREATE INDEX correlation_idx_0 ON correlation (dim_0, cor)")
    # c = conn.cursor()
    # c.execute(
    #     "select count(1) from (select dim_0, dim_1, count(1) from correlation group by dim_0, dim_1 having count(1) > 1)"
    # )
    # rec = c.fetchone()
    # assert rec[0] == 0, "Found {} dups".format(rec[0])
    # c.close()
    print("Done")


def with_shared_cell_lines(dep_df, biomarker_df):
    shared_cell_lines = np.intersect1d(dep_df.index, biomarker_df.index)
    dep_df = dep_df.loc[shared_cell_lines]
    biomarker_df = biomarker_df.loc[shared_cell_lines]
    return dep_df, biomarker_df


from scipy import stats


def _calc_cor_pq_values(n, c):
    # n is the number of pairs of values used to compute the correlation
    # c is the pearson correlation for which we want the p-value

    dist = stats.beta(n / 2 - 1, n / 2 - 1, loc=-1, scale=2)
    p = 2 * dist.cdf(-abs(c))

    if np.isfinite(p).all():
        q = stats.false_discovery_control(p, axis=1)
    else:
        q = np.array(p)
        q[np.isfinite(p)] = stats.false_discovery_control(p[np.isfinite(p)])
    return p, np.asarray(q)


def chunk(values, chunksize):
    for i in range(0, len(values), chunksize):
        yield values[i : i + chunksize]


def create_correlation_dfs(dep_df, biomarker_df, batchsize, min_samples):
    # assumes rows have already been aligned
    biomarker_df.columns = list(range(len(biomarker_df.columns)))
    dep_df_indices = np.arange(len(dep_df.columns))

    for dep_df_partial_indices in tqdm(list(chunk(dep_df_indices, batchsize))):

        dep_df_partial = dep_df.iloc[:, dep_df_partial_indices]

        correlations, sample_counts = fast_cor_with_missing(
            dep_df_partial.values, biomarker_df.values, min_samples
        )
        p, q = _calc_cor_pq_values(sample_counts, correlations)

        for partial_i, dep_col_i in enumerate(dep_df_partial_indices):
            yield dep_col_i, pd.DataFrame(
                {
                    "dim_1": np.arange(correlations.shape[1]),
                    "cor": correlations[partial_i],
                    "samples": sample_counts[partial_i],
                    "pvalue": p[partial_i],
                    "qvalue": q[partial_i],
                }
            )


def filter_df(df, limit, limit_per_sign):
    # Taken from PRISM portal: Only the top 250 features, or top 25 negative and positive
    # correlations based on q-value at each condition are included in the plots. Associations
    # with q-values above 0.1 are omitted from both plot and table.
    cor_col = df["cor"]
    top_250_abs = (-cor_col.abs()).rank() <= limit
    top_25_neg = cor_col.mask(cor_col >= 0, np.nan).rank() <= limit_per_sign
    top_25_pos = cor_col.mask(cor_col <= 0, np.nan).rank() <= limit_per_sign
    small_q = df["qvalue"] < 0.1
    return df[(top_250_abs | top_25_neg | top_25_pos) & small_q]


def create_correlations_df(m_0, m_1, batch_size, limit, minsamples, limit_per_sign):
    dfs = []
    for m_0_col, cor_df in create_correlation_dfs(m_0, m_1, batch_size, minsamples):
        cor_df = filter_df(cor_df, limit, limit_per_sign).copy()
        cor_df["dim_0"] = m_0_col
        dfs.append(cor_df)
    return pd.concat(dfs)


# def create_correlations_df_partial(dep_df, biomarker_df_partial, limit, min_samples, limit_per_sign):

#     (
#         abs_top_ranked_cols_per_row,
#         abs_top_ranked_rows_per_col,
#         abs_row_indexes,
#         abs_col_indexes,
#     ) = top_ranked_indexes_per_row_and_col(-np.abs(correlations), limit)

#     (
#         neg_top_ranked_cols_per_row,
#         neg_top_ranked_rows_per_col,
#         neg_row_indexes,
#         neg_col_indexes,
#     ) = top_ranked_indexes_per_row_and_col(_new_masked_matrix(correlations, correlations>=0), limit_per_sign)

#     (
#         pos_top_ranked_cols_per_row,
#         pos_top_ranked_rows_per_col,
#         pos_row_indexes,
#         pos_col_indexes,
#     ) = top_ranked_indexes_per_row_and_col(_new_masked_matrix(correlations, correlations<=0), limit_per_sign)

#     dfs = []

#     for (top_ranked_cols_per_row,
#         top_ranked_rows_per_col,
#         row_indexes,
#         col_indexes) in [
#             (
# abs_top_ranked_cols_per_row,
#         abs_top_ranked_rows_per_col,
#         abs_row_indexes,
#         abs_col_indexes),
#         (neg_top_ranked_cols_per_row,
#         neg_top_ranked_rows_per_col,
#         neg_row_indexes,
#         neg_col_indexes),

# (
#         pos_top_ranked_cols_per_row,
#         pos_top_ranked_rows_per_col,
#         pos_row_indexes,
#         pos_col_indexes,
#     )
#         ]:

#         df = pd.DataFrame(
#         {
#             "cor": np.hstack(
#                 (
#                     correlations[row_indexes, top_ranked_cols_per_row],
#                     correlations[top_ranked_rows_per_col, col_indexes],
#                 )
#             ),
#             "samples": np.hstack(
#                 (
#                     sample_counts[row_indexes, top_ranked_cols_per_row],
#                     sample_counts[top_ranked_rows_per_col, col_indexes],
#                 ))
#             ,
#             "dim_0": list(row_indexes) + list(top_ranked_rows_per_col),
#             "dim_1": biomarker_df_partial.columns[
#                 list(top_ranked_cols_per_row) + list(col_indexes)
#             ],
#         },
#         columns=["dim_0", "dim_1", "cor", "samples"],
#         )
#         dfs.append(df)

#     merged_df = pd.concat(dfs)
#     return merged_df.drop_duplicates(["dim_0", "dim_1"])


def top_ranked_indexes_per_row_and_col(matrix, limit):
    """Gets the coordinates for the largest `LIMIT` values, by row and by column."""
    num_rows, num_cols = matrix.shape
    limit_per_col = min(num_rows, limit)
    limit_per_row = min(num_cols, limit)

    top_ranked_cols_per_row = np.argpartition(matrix, limit_per_row - 1, axis=1)[
        :, :limit_per_row
    ].flatten()
    top_ranked_rows_per_col = np.argpartition(matrix, limit_per_col - 1, axis=0)[
        :limit_per_col
    ].flatten()

    row_indexes = np.repeat(range(num_rows), limit_per_row)
    col_indexes = np.tile(range(num_cols), limit_per_col)

    return top_ranked_cols_per_row, top_ranked_rows_per_col, row_indexes, col_indexes


def fast_cor_with_missing(x, y, min_number_of_points):
    # preallocate storage for the matrix of correlations
    result = np.zeros(shape=(x.shape[1], y.shape[1]))
    # preallocate storage for the matrix of n (number of pairwise-non-NA samples)
    sample_count = np.zeros(shape=(x.shape[1], y.shape[1]), dtype=int)

    x_groups = group_cols_with_same_mask(x)
    y_groups = group_cols_with_same_mask(y)
    for x_mask, x_columns in x_groups:
        for y_mask, y_columns in y_groups:
            # print(x_mask, x_columns, y_mask, y_columns)
            combined_mask = x_mask & y_mask
            number_of_points = np.sum(combined_mask)
            if number_of_points < min_number_of_points:
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
            sample_count[np.ix_(x_columns, y_columns)] = number_of_points

    return result, sample_count


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


def concat_dfs_and_filter(dfs, limit):
    # todo: update to respect signed limit
    df = pd.concat(dfs, ignore_index=True, sort=False)
    df["cor_abs"] = df["cor"].abs()
    df["dim_0_rank"] = df.groupby("dim_1")["cor_abs"].rank(ascending=False)
    df["dim_1_rank"] = df.groupby("dim_0")["cor_abs"].rank(ascending=False)
    df = df[(df["dim_0_rank"] <= limit) | (df["dim_1_rank"] <= limit)]
    del df["cor_abs"]
    del df["dim_0_rank"]
    del df["dim_1_rank"]
    return df


if __name__ == "__main__":
    main()
