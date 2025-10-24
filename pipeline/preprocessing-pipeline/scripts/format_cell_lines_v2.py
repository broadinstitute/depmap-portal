import numpy as np
import pandas as pd
from taigapy import create_taiga_client_v3


def assert_df_format(df, expected_columns, ignore_extra_columns=True):
    # compute an index of column name -> type
    df_column_types = dict(zip(df.columns, df.dtypes))

    unverified_columns = set(df_column_types.keys())
    problems = []
    for name, type in expected_columns:
        if type is str:
            type = object
        if name not in df_column_types:
            problems.append(f"missing column {name}")
            continue
        unverified_columns.remove(name)
        if df_column_types[name] != type:
            problems.append(
                f"expected column {name} to have type {type} but was {df_column_types[name]}"
            )
            continue

    if not ignore_extra_columns:
        if len(unverified_columns) > 0:
            extra_columns = list(unverified_columns)
            problems.append(f"extra columns: {extra_columns}")

    assert (
        len(problems) == 0
    ), f"Found following problems: {problems} in dataframe: {df}"


# if this is updated, be sure to update sample_data/cell_line/cell_line_metadata.csv
# to make sure these are using the same set of column names
expected_columns = set(
    (
        "ccle_name,display_name,cosmic_id,catalog_number,growth_pattern,full_cell_line_name,cclf_gender,primary_disease_name,tumor_type_name,subtype_name,wtsi_master_cell_id,arxspan_id,alt_names,aliases,lineage_1,lineage_2,lineage_3,lineage_4,original_source,image_filename,rrid,comments,cell_line_passport_id,legacy_molecular_subtype,legacy_sub_subtype"
    ).split(",")
)


def verify_expected_columns(columns):
    columns_set = set(columns)

    for col in columns_set:
        assert col == col.lower(), "column {} was not in lowercase".format(col)

    for col in expected_columns:
        assert col in columns_set, "Could not find {} in {}".format(col, columns)


import argparse


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
    # fetch this twice because of a bug in taigapy which causes blanks to be None when reading
    # from the cache and NaN when reading it from the server anew. This will force it to
    # consistently read it from the cache. Hopefully will fix the issue in taigapy before long
    sample_info = tc.get(model_dataset_id)
    cell_line_images = tc.get(cell_line_images_dataset_id)

    # this is a temporary hack to workaround the fact that we don't have
    # this column in the 22Q4 data release's model table, but we
    # have code assuming it will be there. If it's missing, just
    # create the column as blank
    if "CatalogNumber" not in set(sample_info.columns):
        sample_info["CatalogNumber"] = ""

    sample_info.to_csv("tmp.csv")

    column_rename_map = {
        "CCLEName": "ccle_name",
        "COSMICID": "cosmic_id",
        "ModelID": "arxspan_id",
        "OncotreeLineage": "lineage_1",
        "OncotreePrimaryDisease": "lineage_2",
        "OncotreeSubtype": "lineage_3",
        "Sex": "cclf_gender",
        "RRID": "rrid",
        "StrippedCellLineName": "display_name",
        "GrowthPattern": "growth_pattern",
        "CatalogNumber": "catalog_number",
        "SourceType": "original_source",
        "PrimaryOrMetastasis": "tumor_type_name",
        "PublicComments": "comments",
        "WTSIMasterCellID": "wtsi_master_cell_id",
        "CellLineName": "full_cell_line_name",
        "SangerModelID": "cell_line_passport_id",
        "ModelSubtypeFeatures": "legacy_molecular_subtype",
    }

    sample_info.rename(columns=column_rename_map, inplace=True)
    sample_info["primary_disease_name"] = sample_info["lineage_2"]
    sample_info["subtype_name"] = sample_info["lineage_3"]
    # fill in blanks for the columns we no longer have
    # sample_info["lineage_3"] = [None] * sample_info.shape[0]
    sample_info["lineage_4"] = [None] * sample_info.shape[0]
    sample_info["aliases"] = [None] * sample_info.shape[0]

    assert len(sample_info.columns) == len(
        set(sample_info.columns)
    ), "Duplicate columns detected"

    # Introduce blank alt_names column, suspect it's only used for BeatAML
    sample_info["alt_names"] = ""

    # add image paths
    sample_info = pd.merge(
        sample_info,
        cell_line_images[["arxspan_id", "image_name"]],
        left_on="arxspan_id",
        right_on="arxspan_id",
        how="left",
    )

    sample_info.rename(
        columns={"image_name": "image_filename",}, inplace=True,
    )

    sample_info.replace(np.nan, "", regex=True, inplace=True)
    sample_info.sort_index(inplace=True)

    if "Unnamed: 0" in sample_info.columns:
        sample_info.drop(columns="Unnamed: 0", inplace=True)

    sample_info.drop_duplicates(inplace=True)
    assert not any(sample_info["arxspan_id"].duplicated())

    # this column was removed from the data dictionary, so populate it with NAs until
    # we've updated the data loader to stop trying to read the column
    sample_info["legacy_sub_subtype"] = pd.NA

    # only keep the expected columns. Add column name if you want it to appear in output csv

    assert_df_format(
        sample_info,
        [
            ("aliases", str),
            ("alt_names", str),
            ("arxspan_id", str),
            ("ccle_name", str),
            ("cclf_gender", str),
            ("comments", str),
            ("cosmic_id", str),
            ("growth_pattern", str),
            ("catalog_number", str),
            ("display_name", str),
            ("full_cell_line_name", str),
            ("image_filename", str),
            ("lineage_1", str),
            ("lineage_2", str),
            ("lineage_3", str),
            ("lineage_4", str),
            ("original_source", str),
            ("primary_disease_name", str),
            ("rrid", str),
            ("subtype_name", str),
            ("tumor_type_name", str),
            ("wtsi_master_cell_id", str),
            ("cell_line_passport_id", str),
        ],
    )

    sample_info = sample_info[list(expected_columns)]
    verify_expected_columns(sample_info.columns)

    sample_info = sample_info[sorted(sample_info.columns)]
    sample_info.to_csv(outfile)


################################################################################
# verification code
################################################################################


def check(df):
    sample_info = df.set_index("arxspan_id")

    cell_lines = [
        y.strip() for y in open("pipeline/cell_lines.txt").readlines()
    ]  # grab list of cell lines from db
    compare = pd.read_csv("./pipeline/prev_cell_line_metadata.csv")
    compare = compare[compare["arxspan_id"].isin(cell_lines)]

    # Formatting
    compare = compare.drop(columns="Unnamed: 0")
    compare = compare.set_index("arxspan_id")
    compare = compare.replace(np.nan, "", regex=True)

    for c in compare.columns:
        print(f"Column: {c}")
        compare_dict = {k: compare.loc[k][c] for k in compare.index}
        for k, v in compare_dict.items():
            if k not in sample_info.index:
                print(f"{k} not in sample_info")
            val = sample_info.loc[k][c]
            if isinstance(val, pd.Series):
                val = val.to_list()[0]
            if val != v:
                if v == "":
                    print("empty in prev")
                else:
                    if len(v) == 0:
                        print(f"{k}, {c} empty in prev, {val} in sample_info.")
                    elif len(val) == 0:
                        print(f"{k}, {c} empty in sample_info, {val} in prev.")
                    else:
                        print(f"mismatch {k}, {v}, {val}")


if __name__ == "__main__":
    main()
