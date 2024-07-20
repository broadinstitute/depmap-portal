import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3
import pandera as pa


import argparse

schema = pa.DataFrameSchema(
    {
        "model_id": pa.Column(str, unique=True),
        "patient_id": pa.Column(str),
        "cell_line_name": pa.Column(str),
        "stripped_cell_line_name": pa.Column(str),
        "depmap_model_type": pa.Column(str),
        "oncotree_lineage": pa.Column(str),
        "oncotree_primary_disease": pa.Column(str),
        "oncotree_subtype": pa.Column(str),
        "oncotree_code": pa.Column(str),
        "legacy_molecular_subtype": pa.Column(str),
        "patient_molecular_subtype": pa.Column(str),
        "rrid": pa.Column(str),
        "age": pa.Column(str),
        "age_category": pa.Column(str),
        "sex": pa.Column(str),
        "patient_race": pa.Column(str),
        "primary_or_metastasis": pa.Column(str),
        "sample_collection_site": pa.Column(str),
        "source_type": pa.Column(str),
        "source_detail": pa.Column(str),
        "treatment_status": pa.Column(str),
        "treatment_details": pa.Column(str),
        "growth_pattern": pa.Column(str),
        "onboarded_media": pa.Column(str),
        "formulation_id": pa.Column(str),
        "engineered_model": pa.Column(str),
        "tissue_origin": pa.Column(str),
        "ccle_name": pa.Column(str),
        "catalog_number": pa.Column(str),
        "plate_coating": pa.Column(str),
        "model_derivation_material": pa.Column(str),
        "public_comments": pa.Column(str),
        "wtsi_master_cell_id": pa.Column(str),
        "sanger_model_id": pa.Column(str),
        "cosmic_id": pa.Column(str),
        "legacy_sub_subtype": pa.Column(str),
        "image_filename": pa.Column(str),
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

    sample_info = tc.get(model_dataset_id)

    # Used to display images on the CellLine page's description tile (if an image exists)
    cell_line_images = tc.get(cell_line_images_dataset_id)

    sample_info.to_csv("tmp.csv")

    to_snakecase = {
        "ModelID": "arxspan_id",
        "PatientID": "patient_id",
        "CellLineName": "cell_line_name",
        "StrippedCellLineName": "stripped_cell_line_name",
        "DepmapModelType": "depmap_model_type",
        "OncotreeLineage": "oncotree_lineage",
        "OncotreePrimaryDisease": "oncotree_primary_disease",
        "OncotreeSubtype": "oncotree_subtype",
        "OncotreeCode": "oncotree_code",
        "LegacyMolecularSubtype": "legacy_molecular_subtype",
        "PatientMolecularSubtype": "patient_molecular_subtype",
        "RRID": "rrid",
        "Age": "age",
        "AgeCategory": "age_category",
        "Sex": "sex",
        "PatientRace": "patient_race",
        "PrimaryOrMetastasis": "primary_or_metastasis",
        "SampleCollectionSite": "sample_collection_site",
        "SourceType": "source_type",
        "SourceDetail": "source_detail",
        "TreatmentStatus": "treatment_status",
        "TreatmentDetails": "treatment_details",
        "GrowthPattern": "growth_pattern",
        "OnboardedMedia": "onboarded_media",
        "FormulationID": "formulation_id",
        "EngineeredModel": "engineered_model",
        "TissueOrigin": "tissue_origin",
        "CCLEName": "ccle_name",
        "CatalogNumber": "catalog_number",
        "PlateCoating": "plate_coating",
        "ModelDerivationMaterial": "model_derivation_material",
        "PublicComments": "public_comments",
        "WTSIMasterCellID": "wtsi_master_cell_id",
        "SangerModelID": "sanger_model_id",
        "COSMICID": "cosmic_id",
        "LegacySubSubtype": "legacy_sub_subtype",
    }

    ##########################
    # start of hacks for staging internal
    missing = set(to_snakecase.keys()).difference(sample_info.columns)
    extra = set(sample_info.columns).difference(to_snakecase.keys())

    print(f"warning: missing {missing}")
    print(f"warning: extra {extra}")

    for missing_column in missing:
        sample_info[missing_column] = pd.NA
    if len(extra) > 0:
        sample_info.drop(columns=extra, inplace=True)

    # end of hacks
    ##############################

    sample_info.rename(columns=to_snakecase, inplace=True)

    # add image paths
    sample_info = pd.merge(
        sample_info,
        cell_line_images[["arxspan_id", "image_name"]],
        left_on="arxspan_id",
        right_on="arxspan_id",
        how="left",
    )

    sample_info.rename(
        columns={"image_name": "image_filename", "arxspan_id": "model_id"},
        inplace=True,
    )
    sample_info.replace(np.nan, "", regex=True, inplace=True)
    sample_info.sort_index(inplace=True)

    sample_info.drop_duplicates(inplace=True)
    assert not any(sample_info["model_id"].duplicated())

    sample_info = schema.validate(sample_info)
    sample_info.to_csv(outfile)


if __name__ == "__main__":
    main()
