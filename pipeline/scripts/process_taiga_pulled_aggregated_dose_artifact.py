import shutil
import taigapy
import pandas as pd
import os
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_label")
    parser.add_argument("cell_lines_dataset_id")
    parser.add_argument("perturbations_dataset_id")
    parser.add_argument("dataset_id")
    args = parser.parse_args()

    dataset_label = args.dataset_label
    cell_lines_dataset_id = args.cell_lines_dataset_id
    dataset_id = args.dataset_id
    perturbations_dataset_id = args.perturbations_dataset_id

    tc = taigapy.TaigaClient()

    def download_to_path(taiga_id, dest):
        cached = tc.download_to_cache(taiga_id)
        shutil.copy2(cached, dest)

    download_to_path(dataset_id, "out.csv")
    download_to_path(perturbations_dataset_id, "perturbations.csv")

    assert os.path.exists("out.csv"), "Output file 'out.csv' not generated"


if __name__ == "__main__":
    main()
