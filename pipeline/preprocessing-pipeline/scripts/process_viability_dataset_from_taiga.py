import shutil
import taigapy
import pandas as pd
import os
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_label")
    parser.add_argument("perturbations_dataset_id")
    parser.add_argument("dataset_id")
    parser.add_argument("units")
    args = parser.parse_args()

    dataset_label = args.dataset_label
    dataset_id = args.dataset_id
    perturbations_dataset_id = args.perturbations_dataset_id
    units = args.units

    assert units in ["log_viability", "viability"]

    tc = taigapy.create_taiga_client_v3()

    ### The if block is here to convert the new oncref format to the old viability format so that
    ### the oncref datasets can be ingested in the pipeline without much additional changes.
    ### The cell lines df can be generated from the new format directly. So it is not there separately in taiga.
    viability_df_new_format = tc.get(dataset_id)

    if units == "log_viability":
        # the portal is expecting non-log viabilities
        viability_df_new_format = 2 ** viability_df_new_format

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

    assert os.path.exists("out.csv"), "Output file 'out.csv' not generated"


if __name__ == "__main__":
    main()
