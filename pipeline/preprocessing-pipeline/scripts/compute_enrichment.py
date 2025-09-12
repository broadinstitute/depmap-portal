import json
import argparse
import pandas as pd
import numpy as np
from hdf5_utils import read_hdf5
from scipy.stats import ttest_ind


def compute_enrichments(dep_datasets, context_matrix):
    all_dataset_context_results = []

    for dataset in dep_datasets:  # rows are entities, cols are cell line
        df = read_hdf5(dataset["filename"])
        for context in context_matrix.index:  # rows are contexts
            context_series = context_matrix.loc[context]
            in_lines = context_series[context_series == 1].index
            out_lines = context_series[context_series == 0].index
            assert len(in_lines) + len(out_lines) == len(context_series)

            # run t tests, across all entities in the dataset
            raw_result = t_test_on_dataset(df, in_lines, out_lines)

            if raw_result is None:
                print("so skipping {} in {}".format(context, dataset["label"]))
            else:
                # keep only significant ones
                filtered_result = raw_result[
                    raw_result["p_value"] < 0.0005
                ]  # CHANGE GENE EXECUTIVE TEXT IF THIS P VALUE CUTOFF IS CHANGED
                if filtered_result.empty:
                    print(
                        "No significant result was Found. So skipping {} in {}".format(
                            context, dataset["label"]
                        )
                    )
                else:
                    filtered_result = filtered_result.assign(
                        context=context, dataset=dataset["label"]
                    )
                    all_dataset_context_results.append(filtered_result)

    if not all_dataset_context_results:
        raise ValueError("No result was found.")

    result = pd.concat(all_dataset_context_results)
    return result


def t_test_on_dataset(df, in_lines, out_lines):
    in_lines = list(
        set(df.columns).intersection(in_lines)
    )  # Passing a set as an indexer is deprecated and will raise an error in a future version. So converted it to a list.
    out_lines = list(set(df.columns).intersection(out_lines))
    # some lines in the dataset may not be in the context matrix, so we can't assert the sum of lengths

    if len(in_lines) <= 3 or len(out_lines) <= 3:
        print(
            "Only found {} in lines, {} out lines,".format(
                len(in_lines), len(out_lines)
            )
        )
        return None

    mean_diff = df[in_lines].mean(axis=1) - df[out_lines].mean(axis=1)

    # ttest across rows
    t_statistic, p_value = ttest_ind(
        df[in_lines], df[out_lines], axis=1, nan_policy="omit"
    )
    row_names = df.index

    # sometimes returns a masked array, that occasionally has masked values
    # we drop these masked rows
    # GDSC1_AUC has masked values
    if np.ma.is_masked(t_statistic) or np.ma.is_masked(p_value):
        # assert that the masks are the same
        np.testing.assert_array_equal(t_statistic.mask, p_value.mask)

        # then we can use the t_statistic mask to index
        invalid_values_indexer = t_statistic.mask

        # select only positions corresponding to unmasked values
        row_names = row_names[~invalid_values_indexer]
        t_statistic = t_statistic[~invalid_values_indexer]
        p_value = p_value[~invalid_values_indexer]
        mean_diff = mean_diff[~invalid_values_indexer]

    result = pd.DataFrame(
        {
            "Gene": row_names,  # column label is weird for compounds, but consistent with downstream column name expectations
            "t_statistic": t_statistic,
            "p_value": p_value,
            "effect_size_means_difference": mean_diff,
        }
    )  # i don't even know if this is correct, realining with indices
    return result


parser = argparse.ArgumentParser(description="")
parser.add_argument("--dep_datasets", help="json string of dep dataset metadata")
parser.add_argument(
    "--context_matrix", help="file path to context hdf5 file",
)

args = parser.parse_args()

dep_datasets = json.loads(args.dep_datasets)
context_matrix = read_hdf5(args.context_matrix)
enrichments = compute_enrichments(dep_datasets, context_matrix)
enrichments.to_csv("t-test-enrichment.csv", index=False)
