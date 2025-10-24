import csv
import numpy
import h5py
import sys
import pandas as pd


def write_hdf5(file_path, matrix):
    with h5py.File(file_path, "w") as f:
        f.create_dataset("data", dtype="f", data=matrix)
        f.create_dataset("dim_0", dtype="f", data=range(0, len(matrix)))
        f.create_dataset("dim_1", dtype="f", data=range(len(matrix[0])))


def transform_dose_csv_file(csv_file, perturbation_csv, cell_line_index_csv, hdf5_dest):
    df = pd.read_csv(csv_file)[
        ["cell_line_name", "compound_name", "replicate", "masked", "dose", "viability"]
    ]
    df.dropna(subset=["cell_line_name", "compound_name", "dose"], inplace=True)

    unique_perturbs = (
        df[["compound_name", "replicate", "dose", "masked"]]
        .drop_duplicates()
        .reset_index(drop=True)
        .reset_index()
    )
    unique_cell_lines = (
        df[["cell_line_name"]].drop_duplicates().reset_index(drop=True).reset_index()
    )

    # write out the perturb indices
    unique_perturbs.to_csv(perturbation_csv)

    # write the cell line index
    unique_cell_lines.to_csv(cell_line_index_csv)

    df = df.merge(unique_perturbs.rename(columns={"index": "perturb_index"})).merge(
        unique_cell_lines.rename(columns={"index": "cell_line_index"})
    )
    df = df.pivot(index="perturb_index", columns="cell_line_index", values="viability")
    write_hdf5(hdf5_dest, df.values)


if __name__ == "__main__":
    transform_dose_csv_file(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
