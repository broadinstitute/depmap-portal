import argparse
import difflib
import os
import sys
from typing import List, Set

import pandas as pd

depmap_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
sys.path.append(depmap_root)

from depmap.utilities.hdf5_utils import read_hdf5
from sample_data.subset_files.subsets import contexts, genes, genes_entrez_ids


def get_sample_entities(filename: str, transpose: bool = False) -> List[str]:
    df = read_hdf5(os.path.join(depmap_root, "sample_data/dataset", filename))

    if transpose:
        df = df.T

    return df.index.tolist()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    # If sample_data/predictability/predictive_models_{dataset_name}.csv or webapp_data/predictability/{dataset_name}_predictability_results.csv doesn't exist, call endpoint "/predictability_files"
    parser.add_argument("features_file")
    # Obtain from preprocess job rule convert_predictability_feature_metadata output
    parser.add_argument("feature_metadata_file")
    # "portal-backend/sample_data/predictability/predictive_models_{dataset_name}.csv"
    parser.add_argument("out_subset_features_file")
    # "portal-backend/sample_data/predictability/{dataset_name}_models_feature_metadata.csv"
    parser.add_argument("out_subset_feature_metadata_file")

    args = parser.parse_args()

    df: pd.DataFrame = pd.read_csv(args.features_file)
    meta_df: pd.DataFrame = pd.read_csv(
        args.feature_metadata_file,
        dtype={
            "feature_id": str,
            "feature_name": str,
            "gene_symbol": str,
            "entrez_id": "Int32",
        },
    )

    compound_experiments = get_sample_entities("rep-all-single-pt_score.hdf5")

    entrez_ids = [int(entrez_id) for entrez_id in genes_entrez_ids]
    antibodies = get_sample_entities("rppa.hdf5")
    transcription_start_sites = get_sample_entities("rrbs.hdf5")
    metabolites = get_sample_entities("metabolomics.hdf5")
    genesets = get_sample_entities("ssgsea.hdf5", True)
    fusion_sites = get_sample_entities("fusions.hdf5", True)

    meta_df_sub: pd.DataFrame = meta_df[
        (meta_df["dataset"].str.endswith("confounders"))
        | (meta_df["entrez_id"].isin(entrez_ids))
        | (
            (meta_df["dataset"] == "metabolomics")
            & (meta_df["feature_name"].isin(metabolites))
        )
        | ((meta_df["dataset"] == "ssGSEA") & (meta_df["feature_name"].isin(genesets)))
        | ((meta_df["dataset"] == "Lin") & (meta_df["feature_name"].isin(contexts)))
        | (
            (meta_df["dataset"] == "RRBS")
            & (meta_df["feature_name"].isin(transcription_start_sites))
        )
        | ((meta_df["dataset"] == "RPPA") & (meta_df["feature_name"].isin(antibodies)))
    ]
    # There may be no Fusions that are in both the sample data and meta_df, so make our own and concat the two
    fusions_meta = pd.DataFrame(
        {
            "feature_id": [f"{fusion_site}_Fusion" for fusion_site in fusion_sites],
            "feature_name": fusion_sites,
            "dataset": "Fusion",
        }
    )
    meta_df_sub = meta_df_sub.append(fusions_meta)
    df = df[df["gene"].isin(genes) | df["gene"].isin(compound_experiments)]

    def redo_features(df: pd.DataFrame):
        """Modifies features df in place to replace features with those that are loaded in to dev db"""
        feature_columns = [f"feature{i}" for i in range(10)]

        def get_closest(feature_id: str, used: Set[str]):
            feature_meta = (
                meta_df[meta_df["feature_id"] == feature_id]
                .reset_index(drop=True)
                .iloc[0]
            )
            dataset = feature_meta["dataset"]
            # Don't allow one target to have any feature more than once
            possible_replacements = list(
                set(meta_df_sub[meta_df_sub["dataset"] == dataset]["feature_id"]) - used
            )
            matches = difflib.get_close_matches(feature_id, possible_replacements, 1, 0)
            if len(matches) == 0:
                breakpoint()
            return matches[0]

        for i, row in df.iterrows():
            used = set()
            for col in feature_columns:
                feature_id = row[col]
                closest_replacement = get_closest(feature_id, used)
                used.add(closest_replacement)
                df.loc[i, col] = closest_replacement
            assert len(used) == len(feature_columns)

    redo_features(df)

    # Add row with bad ID
    df = df.append(df.iloc[0], ignore_index=True)
    df.iloc[df.shape[0] - 1, 0] = "bad id"

    # Make sure each dataset has at least one feature used
    for (i, dataset) in enumerate(meta_df.dataset.unique()):
        features = meta_df_sub[meta_df_sub["dataset"] == dataset]["feature_id"]
        if len(set(df.values.flatten()).intersection(set(features.values))) > 0:
            continue

        features = list(set(features) - set(df.iloc[0]))

        if len(features) == 0:
            continue
        a_feature = features[0]
        df.loc[df.index[i], "feature0"] = a_feature

    df.to_csv(args.out_subset_features_file, index=False)
    meta_df_sub.to_csv(args.out_subset_feature_metadata_file, index=False)
