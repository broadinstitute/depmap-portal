import argparse
import os

import pandas as pd

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("targets")
    parser.add_argument("data_dir")
    parser.add_argument("partitions")
    parser.add_argument("features_suffix")
    parser.add_argument("predictions_suffix")
    parser.add_argument("output_file")

    args = parser.parse_args()

    targets = pd.read_feather(args.targets)
    targets = targets.set_index("Row.name")

    partitions = pd.read_csv(args.partitions)
    partitions["path_prefix"] = (
        args.data_dir
        + "/"
        + partitions["model"]
        + "_"
        + partitions["start"].map(str)
        + "_"
        + partitions["end"].map(str)
        + "_"
    )
    partitions["feature_path"] = partitions["path_prefix"] + args.features_suffix
    partitions["predictions_path"] = partitions["path_prefix"] + args.predictions_suffix

    assert all(os.path.exists(f) for f in partitions["feature_path"])
    assert all(os.path.exists(f) for f in partitions["predictions_path"])

    all_features = pd.DataFrame().append(
        [pd.read_csv(f) for f in partitions["feature_path"]], ignore_index=True,
    )
    all_features.drop(["score0", "score1", "best"], axis=1, inplace=True)

    # Get pearson correlation of predictions by model
    all_cors = []
    for model in all_features["model"].unique():
        # Merge all files for model
        predictions_filenames = partitions[partitions["model"] == model][
            "predictions_path"
        ]
        predictions = pd.DataFrame().join(
            [pd.read_csv(f, index_col=0) for f in predictions_filenames], how="outer"
        )

        cors = predictions.corrwith(targets)

        # Reshape
        cors = (
            pd.DataFrame(cors)
            .reset_index()
            .rename(columns={"index": "gene", 0: "pearson"})
        )
        cors["model"] = model

        all_cors.append(cors)

    all_cors = pd.concat(all_cors, ignore_index=True)
    ensemble = all_features.merge(all_cors, on=["gene", "model"])

    # Get the highest correlation across models per "gene" (entity)
    ensemble["best"] = ensemble.groupby("gene")["pearson"].rank(ascending=False) == 1

    ensemble = ensemble.sort_values(["gene", "model"])[
        [
            "gene",
            "model",
            "pearson",
            "best",
            "feature0",
            "feature0_importance",
            "feature1",
            "feature1_importance",
            "feature2",
            "feature2_importance",
            "feature3",
            "feature3_importance",
            "feature4",
            "feature4_importance",
            "feature5",
            "feature5_importance",
            "feature6",
            "feature6_importance",
            "feature7",
            "feature7_importance",
            "feature8",
            "feature8_importance",
            "feature9",
            "feature9_importance",
        ]
    ]

    ensemble.to_csv(args.output_file, index=False)
