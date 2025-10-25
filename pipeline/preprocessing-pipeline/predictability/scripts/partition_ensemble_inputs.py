import argparse
import json
import numpy as np
import pandas as pd
import yaml


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dep_matrix")
    parser.add_argument("ensemble_config")

    args = parser.parse_args()

    df = pd.read_feather(args.dep_matrix)
    df = df.set_index(df.columns[0])
    num_genes = df.shape[1]
    #    assert num_genes > 3000

    with open(args.ensemble_config) as f:
        ensemble_config = yaml.load(f, Loader=yaml.SafeLoader)

    start_indexes = []
    end_indexes = []
    models = []

    for model_name, model_config in ensemble_config.items():
        # chunk_size = num_genes // model_config["Jobs"]
        # start_index = np.array(
        #     range(0, (num_genes % chunk_size) * (chunk_size + 1) + 1, chunk_size + 1)
        # ).astype(int)
        # start_index = np.append(
        #     start_index,
        #     np.array(range(start_index[-1] + chunk_size, num_genes, chunk_size)).astype(int),
        # )
        # end_index = np.append(start_index[1:], [num_genes]).astype(int)
        # start_indexes.append(start_index)
        # end_indexes.append(end_index)
        # models.append([model_config["Name"]] * len(start_index))

        num_jobs = int(model_config["Jobs"])
        start_index = np.array(range(0, num_genes, num_jobs))
        end_index = start_index + num_jobs
        end_index[-1] = num_genes
        start_indexes.append(start_index)
        end_indexes.append(end_index)
        models.append([model_name] * len(start_index))

    param_df = pd.DataFrame(
        {
            "start": np.concatenate(start_indexes),
            "end": np.concatenate(end_indexes),
            "model": np.concatenate(models),
        }
    )
    param_df.to_csv("partitions.csv", index=False)
