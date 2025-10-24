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

    ### The if block is here to convert the new oncref format to the old oncref format so that
    ### the oncref datasets can be ingested in the pipeline without much additional changes.
    ### The cell lines df can be generated from the new format directly. So it is not there separately in taiga.
    if dataset_label == "Prism_oncology_dose_replicate":
        viability_df_new_format = tc.get(dataset_id)

        # create a remapping of column labels to their index because the old loader code is expecting the
        # "index" column to literally be the index to the column in the matrix
        label_to_index = {
            str(label): str(index)
            for index, label in enumerate(viability_df_new_format.columns)
        }
        # remap the column names to keep things consistent
        viability_df_new_format.columns = [
            label_to_index[x] for x in viability_df_new_format.columns
        ]

        viability_df_old_format = viability_df_new_format.transpose().copy()
        viability_df_old_format.to_csv("out.csv", index=True)

        cell_lines_df = pd.DataFrame(
            {
                "cell_line_name": viability_df_new_format.index,
                "index": range(len(viability_df_new_format.index)),
            }
        )
        cell_lines_df.to_csv("cell_lines.csv", index=False)

        perturbations_df = tc.get(perturbations_dataset_id)
        perturbations_df = perturbations_df.rename(
            columns={
                "Label": "index",
                "SampleID": "compound_name",
                "Dose": "dose",
                "Replicate": "replicate",
            }
        )
        # map Label field to index
        perturbations_df["index"] = [
            label_to_index[str(x)] for x in perturbations_df["index"]
        ]

        perturbations_df["masked"] = False
        perturbations_df.to_csv("perturbations.csv", index=False)
    else:
        download_to_path(cell_lines_dataset_id, "cell_lines.csv")
        download_to_path(dataset_id, "out.csv")
        download_to_path(perturbations_dataset_id, "perturbations.csv")

    assert os.path.exists("out.csv"), "Output file 'out.csv' not generated"


if __name__ == "__main__":
    main()
