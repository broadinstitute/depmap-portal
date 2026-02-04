from taigapy import create_taiga_client_v3
import pandas as pd
import h5py
import numpy as np
import argparse
from taigapy.client_v3 import LocalFormat, UploadedFile
import json
import re


def split_name(feature_name):
    split_index = feature_name.rindex("_")
    name, dataset = feature_name[:split_index], feature_name[split_index + 1 :]
    return dataset, name


def extract_id_from_parens(feature_name):
    m = re.match("[^(]+\(([^)]+)\)", feature_name)

    if m is None:
        return feature_name.replace(" ", "_")
    assert m is not None, f"format not recognized: {feature_name}"
    return m.group(1)


def main():
    tc = create_taiga_client_v3()

    # load all the predictions and the actual gene effect scores from Taiga
    datasets = {}

    model_names = ["CellContext", "DriverEvents", "GeneticDerangement", "DNA", "RNASeq"]

    for name in model_names:
        datasets[name] = tc.get(f"directpredictiontest-3cb4.14/{name}Prediction")

    for k, v in datasets.items():
        v.to_csv(f"{k}.csv")

    model_features = {}
    for name in model_names:
        df = tc.get(f"directpredictiontest-3cb4.14/{name}Summary")
        df["model_name"] = name
        model_features[name] = df

    for k, v in model_features.items():
        v.to_csv(f"{k}Summary.csv")

    # features = {}
    # seen_feature_types = []

    # def get_full_feature_name(name: str, feature_type: str):
    #     val = name + f"_{feature_type}"
    #     val = val.replace(" ", "_")
    #     return val

    # for model_name in model_names:
    #     dataset_json = tc.download_to_cache(
    #         f"directpredictiontest-3cb4.14/{model_name}JSON",
    #         requested_format=LocalFormat.RAW,
    #     )
    #     with open(dataset_json) as d:
    #         dataset_dict = json.loads(d.read())
    #         for item in dataset_dict:
    #             dataset = dataset_dict[item]
    #             if dataset["table_type"] == "feature":
    #                 feature_dataset = tc.get(dataset["taiga_filename"])
    #                 feature_type = dataset["name"]
    #                 if feature_type in seen_feature_types:
    #                     continue

    #                 feature_names = [
    #                     get_full_feature_name(name, feature_type)
    #                     for name in feature_dataset.index.tolist()
    #                 ]
    #                 features[model_name] = feature_names
    #                 seen_feature_types.append(feature_type)

    # with open("TEST.json", "w") as f:
    #     json.dump(features, f)


if __name__ == "__main__":
    main()
