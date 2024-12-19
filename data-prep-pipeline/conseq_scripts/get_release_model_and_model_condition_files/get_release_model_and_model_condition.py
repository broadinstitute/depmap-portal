import pandas as pd
import argparse
from termcolor import colored

from gumbo_rest_client import Client
from taigapy import create_taiga_client_v3
from model_utils import (
    gumbo_df_preprocessing,
    get_model_ids,
    get_model_condition_ids,
    update_readme_content,
)
import pandera as pa

from files_to_check_models_to_exclude import model_id_exclusion_list


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "data_dictionary_taiga_id",
        type=str,
        help="Taiga ID of the data dictionary e.g. predictability-76d5.142/DataDictionary_20241219_160756",
    )
    parser.add_argument(
        "quarterly_release_dataset_id",
        type=str,
        help="Quarterly release dataset id e.g. internal-23q4-ac2b.68",
    )
    parser.add_argument(
        "previous_dataset_id",
        type=str,
        help="Previous dataset id e.g. internal-23q2-1e49.90",
    )
    parser.add_argument(
        "model_csv_outfile",
        type=str,
        help="Model csv output file name such as model.csv",
    )
    parser.add_argument(
        "model_condition_csv_outfile",
        type=str,
        help="Model Condition csv output file name such as model_condition.csv",
    )
    parser.add_argument(
        "model_diff_outfile",
        type=str,
        help="Model diff csv output file name such as model_diff.csv",
    )
    parser.add_argument(
        "--readme-yaml",
        dest="readme_yaml",
        help="Used to specify where the yaml file is to update with the column name and descriptions for the generated files",
    )

    args = parser.parse_args()
    data_dictionary_taiga_id = args.data_dictionary_taiga_id
    quarterly_release_dataset_id = args.quarterly_release_dataset_id
    previous_model_dataset_id = args.previous_dataset_id + "/Model"
    previous_dataset_id = args.previous_dataset_id
    model_outfile = args.model_csv_outfile
    model_condition_outfile = args.model_condition_csv_outfile
    model_diff_outfile = args.model_diff_outfile
    readme_yaml = args.readme_yaml

    ###############################################
    ### Get the original DataFrames from Gumbo ###
    ###############################################

    gumbo_client = Client()
    print(colored("Gumbo client successfully connected.", "green"))
    orig_model_df = gumbo_client.get("model")
    orig_model_condition_df = gumbo_client.get("model_condition")
    orig_omics_profile_df = gumbo_client.get("omics_profile")

    # Get the data dictionary
    taiga_client_v3 = create_taiga_client_v3()
    data_dictionary_df = taiga_client_v3.get(data_dictionary_taiga_id)

    # Group by 'table_name' and create a new DataFrame for each unique 'table_name'
    grouped = data_dictionary_df.groupby("table_name")

    ## MODEL ##
    data_dictionary_model_df = grouped.get_group("model")
    model_df = gumbo_df_preprocessing(data_dictionary_model_df, orig_model_df)
    # print(colored(f"Shape of model_df: {model_df.shape}", "magenta"))

    model_ids = get_model_ids(quarterly_release_dataset_id)

    # Get Previous Model IDs to whitelist them
    previous_release_model_ids = set(
        taiga_client_v3.get(previous_model_dataset_id)["ModelID"]
    )
    model_ids.update(previous_release_model_ids)

    # Exclude model_ids based on the exclusion list
    model_ids = set(model_ids) - set(model_id_exclusion_list)

    # Total number of new model ids
    new_model_ids = set(model_ids).difference(previous_release_model_ids)
    removed_model_ids = set(previous_release_model_ids).difference(model_ids)

    print(
        colored(
            f"Number of model ids in previous release: {len(previous_release_model_ids)}",
            "yellow",
        )
    )

    print(
        colored(f"Number of model ids in current release: {len(model_ids)}", "yellow")
    )
    print(
        colored(
            f"Number of new model ids in current release: {len(new_model_ids)}", "cyan",
        )
    )
    print(
        colored(
            f"Number of model ids removed in current release: {len(removed_model_ids)}",
            "cyan",
        )
    )

    diff_df = pd.concat(
        [
            pd.DataFrame({"ModelID": list(new_model_ids), "status": "new"}),
            pd.DataFrame({"ModelID": list(removed_model_ids), "status": "removed"}),
        ]
    )
    diff_df.to_csv(model_diff_outfile, index=False)

    print(
        colored(
            f"\n***  Wrote differences to {model_diff_outfile}. Forward to Sam or the relevant stakeholder to make sure that is the correct number of new models that are being released  ***\n",
            "magenta",
        )
    )

    # In model_df keep only the rows where the ModelID is in model_ids
    model_df_filtered = model_df[model_df["ModelID"].isin(model_ids)]
    # print(colored(f"Shape of filtered model_df: {model_df_filtered.shape}", "magenta"))

    # set the ModelID as the index for this table because it'll make it easier to tell
    # which model has a problem when schema.validate reports issues with specific rows
    model_df_filtered.index = model_df_filtered["ModelID"]
    # make sure required columns are present and populated
    schema = pa.DataFrameSchema(
        {
            "ModelID": pa.Column(str),
            "CellLineName": pa.Column(str),
            "StrippedCellLineName": pa.Column(str),
            "DepmapModelType": pa.Column(str),
        }
    )
    schema.validate(model_df_filtered, lazy=True)  # lazy=True to report _all_ errors

    model_df_filtered.to_csv(model_outfile, index=False)
    print(colored(f"Model csv file written to {model_outfile}", "green"))

    ## MODEL CONDITION ##
    data_dictionary_model_condition_df = grouped.get_group("model_condition")
    model_condition_df = gumbo_df_preprocessing(
        data_dictionary_model_condition_df, orig_model_condition_df
    )
    # print(colored(f"Shape of model_condition_df: {model_condition_df.shape}", "magenta"))

    model_condition_ids = get_model_condition_ids(quarterly_release_dataset_id)
    print(
        colored(f"Number of model condition ids: {len(model_condition_ids)}", "yellow")
    )

    # In model_condition_df keep only the rows where the ModelConditionID is in model_condition_ids
    model_condition_df_filtered = model_condition_df[
        model_condition_df["ModelConditionID"].isin(model_condition_ids)
    ].copy()

    model_condition_df_filtered.to_csv(model_condition_outfile, index=False)
    print(
        colored(
            f"Model Condition csv file written to {model_condition_outfile}", "green"
        )
    )

    if readme_yaml:
        update_readme_content(
            readme_yaml,
            data_dictionary_model_df,
            "Model.csv",
            "Metadata describing all cancer models/cell lines which are referenced by a dataset contained within the DepMap portal.",
        )
        update_readme_content(
            readme_yaml,
            data_dictionary_model_condition_df,
            "ModelCondition.csv",
            "The condition(s) under which the model was assayed.",
        )

        print(colored(f"File descriptions updated in {readme_yaml}", "green",))


if __name__ == "__main__":
    main()
