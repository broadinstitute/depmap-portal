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
        "OncotreeCode": pa.Column(str),
        "RRID": pa.Column(str),
        "Age": pa.Column(str),
        "AgeCategory": pa.Column(str),
        "Sex": pa.Column(str),
        "PatientRace": pa.Column(str),
        "PrimaryOrMetastasis": pa.Column(str),
        "SampleCollectionSite": pa.Column(str),
        "SourceType": pa.Column(str),
        "SourceDetail": pa.Column(str),
        "GrowthPattern": pa.Column(str),
        "OnboardedMedia": pa.Column(str),
        "FormulationID": pa.Column(str),
        "EngineeredModel": pa.Column(str),
        "TissueOrigin": pa.Column(str),
        "CCLEName": pa.Column(str),
        "CatalogNumber": pa.Column(str),
        "PlateCoating": pa.Column(str),
        "ModelDerivationMaterial": pa.Column(str),
        "PublicComments": pa.Column(str),
        "WTSIMasterCellID": pa.Column(str),
        "SangerModelID": pa.Column(str),
        "COSMICID": pa.Column(str),
        "Stage": pa.Column(str),
        "CulturedResistanceDrug": pa.Column(str),
        "PatientSubtypeFeatures": pa.Column(str),
        "PatientTreatmentResponse": pa.Column(str),
        "PatientTreatmentStatus": pa.Column(str),
        "PediatricModelType": pa.Column(str),
        "ModelTreatment": pa.Column(str),
        "SerumFreeMedia": pa.Column(str),
        "PatientTumorGrade": pa.Column(str),
        "PatientTreatmentType": pa.Column(str),
        "EngineeredModelDetails": pa.Column(str),
        "ModelAvailableInDbgap": pa.Column(str),
        "PatientTreatmentDetails": pa.Column(str),
        "ModelType": pa.Column(str),
        "ModelSubtypeFeatures": pa.Column(str),
        "StagingSystem": pa.Column(str),
        "ModelIDAlias": pa.Column(str),
        "HCMIID": pa.Column(str),
        "ImageFilename": pa.Column(str),
    },
    strict=True,
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

    try:
        sample_info = schema.validate(models, lazy=True)
    except pa.errors.SchemaErrors as err:
        print(
            "Schema has changed. Update the schema in format_models.py and re-run install_prereqs.sh to regenerate typescript type in ModelAnnotation.ts and then commit all those changes"
        )
        print(err.failure_cases)
        sys.exit(1)
    sample_info.to_csv(outfile, index=False)


import sys

if __name__ == "__main__":
    main()
