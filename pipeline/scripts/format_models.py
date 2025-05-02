import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3
import pandera as pa


import argparse

schema = pa.DataFrameSchema(
    {
        "ModelID": pa.Column(str, unique=True),
        "PatientID": pa.Column(str),
        "CellLineName": pa.Column(str),
        "StrippedCellLineName": pa.Column(str),
        "DepmapModelType": pa.Column(str),
        "OncotreeLineage": pa.Column(str),
        "OncotreePrimaryDisease": pa.Column(str),
        "OncotreeSubtype": pa.Column(str),
        "ImageFilename": pa.Column(str),
    },
    coerce=True,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model_dataset_id")
    parser.add_argument("cell_line_images_dataset_id")
    parser.add_argument("outfile")

    args = parser.parse_args()

    tc = create_taiga_client_v3()
    model_dataset_id = args.model_dataset_id
    cell_line_images_dataset_id = args.cell_line_images_dataset_id
    outfile = args.outfile

    models = tc.get(model_dataset_id)

    # Used to display images on the CellLine page's description tile (if an image exists)
    cell_line_images = tc.get(cell_line_images_dataset_id)

    models.to_csv("tmp.csv")

    # add image paths
    models = pd.merge(
        models,
        cell_line_images[["arxspan_id", "image_name"]],
        left_on="ModelID",
        right_on="arxspan_id",
        how="left",
    )

    models.drop(columns=["arxspan_id"], inplace=True)

    models.rename(
        columns={"image_name": "ImageFilename"}, inplace=True,
    )
    models.replace(np.nan, "", regex=True, inplace=True)
    models.sort_values("ModelID", inplace=True)

    assert not any(models["ModelID"].duplicated())

    sample_info = schema.validate(models)
    sample_info.to_csv(outfile, index=False)


if __name__ == "__main__":
    main()
