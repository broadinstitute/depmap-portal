import argparse
import numpy as np
import pandas as pd
import taigapy
from tqdm import tqdm
from dataclasses import dataclass
from packed_cor_tables import write_cor_df, InputMatrixDesc, read_cor_for_given_id
import json
from typing import List
import re


@dataclass
class Thresholds:
    batch_size: int
    limit: int
    minsamples: int
    limit_per_sign: int
    max_qvalue: float


def _reindex_matrix(mat, given_ids):

    for orig_name, new_name in zip(mat.columns, given_ids):
        if new_name is None:
            print(f"Warning: Could not map {repr(orig_name)}")

    new_mat = mat.loc[:, mat.columns[[x is not None for x in given_ids]]].copy()
    new_given_ids = [x for x in given_ids if x is not None]
    assert len(new_mat.columns) == len(new_given_ids)
    new_mat.columns = new_given_ids
    return new_mat


def map_to_given_ids(mat: pd.DataFrame, parameters: dict) -> pd.DataFrame:
    if "IsDefaultEntryForModel" in mat.columns:
        orig_shape = mat.shape
        print(
            "Detected multiple sequencings present in file -- filtering down by IsDefaultEntryForModel=='Y'"
        )
        mat = mat[mat["IsDefaultEntryForModel"] == "Yes"].copy()
        assert mat.shape[1] > 0, "Filtered out all rows"
        assert (
            sum(mat["ModelID"].duplicated()) == 0
        ), "ModelID must be unique after filtering by IsDefaultEntryForModel"
        mat.index = mat["ModelID"]
        mat.drop(
            columns=[
                "IsDefaultEntryForModel",
                "ModelID",
                "SequencingID",
                "ModelConditionID",
                "IsDefaultEntryForMC",
            ],
            inplace=True,
        )
        print(f"Size before filtering: {orig_shape} After filtering: {mat.shape}")

    feature_names = list(mat.columns)
    feature_id_format = parameters["feature_id_format"]
    if feature_id_format == "gene":
        given_ids = _get_paren_values(feature_names)
    elif feature_id_format == "compound":
        given_ids = _lookup_compound(feature_names, parameters["compounds_taiga_id"])
    elif feature_id_format == "compound+dose":
        given_ids = _lookup_compound_dose(
            feature_names,
            parameters["compounds_taiga_id"],
            parameters["features_taiga_id"],
        )
    elif feature_id_format == "label":
        given_ids = feature_names
    else:
        raise Exception(f"unknown feature_id_format: {feature_id_format}")

    new_mat = _reindex_matrix(mat, given_ids)

    return new_mat


def _get_compound_id_by_sample_id(compound_metadata):
    # create a mapping from sample_id to compound_id
    compound_id_by_sample_id = {}
    for row in compound_metadata.to_records():
        for sample_id in row["SampleIDs"].split(";"):
            compound_id_by_sample_id[sample_id] = row["CompoundID"]
    return compound_id_by_sample_id


def _lookup_compound(feature_names: str, compounds_taiga_id: str) -> List[str]:
    tc = taigapy.create_taiga_client_v3()
    compound_metadata = tc.get(compounds_taiga_id)
    compound_id_by_sample_id = _get_compound_id_by_sample_id(compound_metadata)

    def _lookup(sample_id):
        if (sample_id not in compound_id_by_sample_id) and (
            f"BRD:{sample_id}" in compound_id_by_sample_id
        ):
            sample_id = f"BRD:{sample_id}"
        if sample_id not in compound_id_by_sample_id:
            compound_id = None
        else:
            compound_id = compound_id_by_sample_id[sample_id]
        return compound_id

    return [_lookup(x) for x in feature_names]


def _lookup_compound_dose(
    feature_names: str, compounds_taiga_id: str, compound_dose_annot_taiga_id
) -> List[str]:
    tc = taigapy.create_taiga_client_v3()
    compound_metadata = tc.get(compounds_taiga_id)
    compound_id_by_sample_id = _get_compound_id_by_sample_id(compound_metadata)
    compound_dose_annot = tc.get(compound_dose_annot_taiga_id)

    given_id_by_column = {}
    for record in compound_dose_annot.to_dict("records"):
        compound_id = compound_id_by_sample_id.get("BRD:" + record["SampleID"])
        if compound_id is None:
            continue
        dose = record["Dose"]
        dose_unit = record["DoseUnit"]
        given_id = f"{compound_id} {dose} {dose_unit}"
        original_column_name = record["Label"]
        given_id_by_column[original_column_name] = given_id

    assert len(given_id_by_column) > len(compound_dose_annot) * 0.5

    def _lookup(name):
        return given_id_by_column.get(name)

    return [_lookup(x) for x in feature_names]


def _get_paren_values(feature_names: str) -> List[str]:
    regex = re.compile("\\S+\\s+\\(([A-Z0-9-]+)\\)")

    def _lookup(name):
        # given labels of the form "SYMBOL (entrez_id)" returns the entrez_id portion. (Or None if not in that format)
        m = regex.match(name)
        if m:
            return m.group(1)
        return None

    return [_lookup(x) for x in feature_names]


def read_parameters(filename):
    tc = taigapy.create_taiga_client_v3()

    with open(filename, "rt") as fd:
        parameters = json.load(fd)

    def _subset_params(prefix, parameters):
        new_parameters = {}
        for k, v in parameters.items():
            if k.startswith(prefix):
                new_parameters[k[len(prefix) :]] = v
        return new_parameters

    a_mat = tc.get(parameters["a_taiga_id"])
    a_mat = map_to_given_ids(a_mat, _subset_params("a_", parameters))
    b_mat = tc.get(parameters["b_taiga_id"])
    b_mat = map_to_given_ids(b_mat, _subset_params("b_", parameters))

    return (
        a_mat,
        parameters["a_given_id"],
        parameters["a_taiga_id"],
        b_mat,
        parameters["b_given_id"],
        parameters["b_taiga_id"],
    )


def compute_cor_table(
    in_hdf5_0_df,
    label_0,
    taiga_id_0,
    in_hdf5_1_df,
    label_1,
    taiga_id_1,
    output_file,
    thresholds: Thresholds,
):
    in_hdf5_0_df, in_hdf5_1_df = with_shared_cell_lines(in_hdf5_0_df, in_hdf5_1_df)
    # if we don't have a lot of samples shared, something is wrong
    assert len(in_hdf5_0_df) > thresholds.minsamples
    assert len(in_hdf5_1_df) == len(in_hdf5_0_df)
    correlations_df = create_correlations_df(in_hdf5_0_df, in_hdf5_1_df, thresholds)
    correlations_df["log10qvalue"] = np.log10(correlations_df["qvalue"])
    correlations_df = correlations_df[["dim_0", "dim_1", "cor", "log10qvalue"]]

    print(f"Writing to {output_file}")
    write_cor_df(
        correlations_df,
        InputMatrixDesc(
            given_ids=list(in_hdf5_0_df.columns), taiga_id=taiga_id_0, name=label_0
        ),
        InputMatrixDesc(
            given_ids=list(in_hdf5_1_df.columns), taiga_id=taiga_id_1, name=label_1
        ),
        output_file,
    )
    print("Done")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json")
    parser.add_argument("--minsamples", type=int, default=30)
    parser.add_argument("--batchsize", type=int, default=500)
    parser.add_argument("--limit", type=int, default=250)
    parser.add_argument("--maxqvalue", type=float, default=0.1)
    parser.add_argument("--limit-per-sign", type=int, default=25, dest="limit_per_sign")
    parser.add_argument("output_file")

    args = parser.parse_args()

    (
        in_hdf5_0_df,
        label_0,
        taiga_id_0,
        in_hdf5_1_df,
        label_1,
        taiga_id_1,
    ) = read_parameters(args.input_json)

    compute_cor_table(
        in_hdf5_0_df,
        label_0,
        taiga_id_0,
        in_hdf5_1_df,
        label_1,
        taiga_id_1,
        args.output_file,
        Thresholds(
            args.batchsize,
            args.limit,
            args.minsamples,
            args.limit_per_sign,
            args.maxqvalue,
        ),
    )


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
    biomarker_df = biomarker_df.copy()
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


def filter_df(df, limit, limit_per_sign, max_qvalue):
    # Taken from PRISM portal: Only the top 250 features, or top 25 negative and positive
    # correlations based on q-value at each condition are included in the plots. Associations
    # with q-values above 0.1 are omitted from both plot and table.
    cor_col = df["cor"]
    top_250_abs = (-cor_col.abs()).rank() <= limit
    top_25_neg = cor_col.mask(cor_col >= 0, np.nan).rank() <= limit_per_sign
    top_25_pos = cor_col.mask(cor_col <= 0, np.nan).rank() <= limit_per_sign
    small_q = df["qvalue"] < max_qvalue
    return df[(top_250_abs | top_25_neg | top_25_pos) & small_q]


def create_correlations_df(m_0, m_1, thresholds: Thresholds):
    dfs = []
    for m_0_col, cor_df in create_correlation_dfs(
        m_0, m_1, thresholds.batch_size, thresholds.minsamples
    ):
        cor_df = filter_df(
            cor_df, thresholds.limit, thresholds.limit_per_sign, thresholds.max_qvalue
        ).copy()
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


def test_small_end_to_end(tmpdir):
    output_file = str(tmpdir.join("out.sqlite3"))

    in_hdf5_0_df = pd.DataFrame(
        [[1, -1], [2, 1], [3, -1], [4, 1]],
        columns=["A", "B"],
        index=["ACH-01", "ACH-02", "ACH-03", "ACH-04"],
    )
    label_0 = "X"
    taiga_id_0 = "taiga-x"
    in_hdf5_1_df = pd.DataFrame(
        [[10, -10], [20, 10], [30, 10], [40, -10]],
        columns=["C", "D"],
        index=["ACH-01", "ACH-02", "ACH-03", "ACH-04"],
    )
    label_1 = "Y"
    taiga_id_1 = "taiga-y"
    compute_cor_table(
        in_hdf5_0_df,
        label_0,
        taiga_id_0,
        in_hdf5_1_df,
        label_1,
        taiga_id_1,
        output_file,
        Thresholds(
            batch_size=100, limit=100, minsamples=0, limit_per_sign=100, max_qvalue=100
        ),
    )

    df = read_cor_for_given_id(output_file, "A")

    rows = df.sort_values("feature_given_id_1").to_dict("records")
    assert rows[0]["dataset_given_id_0"] == "X"
    assert rows[0]["dataset_given_id_1"] == "Y"
    assert rows[0]["feature_given_id_0"] == "A"
    assert rows[0]["feature_given_id_1"] == "C"
    assert abs(rows[0]["cor"] - 1.0) < 1e-5

    assert rows[1]["dataset_given_id_0"] == "X"
    assert rows[1]["dataset_given_id_1"] == "Y"
    assert rows[1]["feature_given_id_0"] == "A"
    assert rows[1]["feature_given_id_1"] == "D"
    assert abs(rows[1]["cor"] - 0.0) < 1e-5


def test_map_to_given_ids_compound():
    tc = taigapy.create_taiga_client_v3()
    mat = tc.get(
        "prism-oncology-reference-set-24q4-c0d0.1/PRISMOncologyReferenceAUCMatrix"
    )

    new_mat = map_to_given_ids(
        mat,
        {
            "compounds_taiga_id": "internal-24q4-8c04.115/PortalCompounds",
            "feature_id_format": "compound",
        },
    )
    print("before")
    print(mat)
    print("after")
    print(new_mat)


def test_map_to_given_ids_gene():
    tc = taigapy.create_taiga_client_v3()
    mat = tc.get("internal-24q4-8c04.13/OmicsExpressionProteinCodingGenesTPMLogp1")

    new_mat = map_to_given_ids(mat, {"feature_id_format": "gene"})
    print("before")
    print(mat)
    print("after")
    print(new_mat)


def test_map_to_given_ids_compound_dose():
    tc = taigapy.create_taiga_client_v3()
    mat = tc.get(
        "prism-oncology-reference-set-24q4-c0d0.1/PRISMOncologyReferenceLog2ViabilityCollapsedMatrix"
    )

    new_mat = map_to_given_ids(
        mat,
        {
            "features_taiga_id": "prism-oncology-reference-set-24q4-c0d0.1/PRISMOncologyReferenceLog2ViabilityCollapsedConditions",
            "compounds_taiga_id": "internal-24q4-8c04.115/PortalCompounds",
            "feature_id_format": "compound+dose",
        },
    )
    print("before")
    print(mat)
    print("after")
    print(new_mat)


if __name__ == "__main__":
    main()
