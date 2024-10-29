from gumbo_rest_client import Client
from taigapy import create_taiga_client_v3
import pandas as pd
from files_to_check_models_to_exclude import quarterly_files_to_check
import io
import yaml
import re
from tqdm import tqdm


def get_second_part_of_string(string: str) -> str:
    """
    This function takes a string and returns the second part of the string if there is a dot, otherwise returns the whole string.

    Args:
        string (str): String

    Returns:
        str: Second part of the string if there is a dot, otherwise returns the whole string.
    """
    if "." in string:
        return string.split(".")[1]
    else:
        return string


def filter_empty_strings(list_with_empty_strings: list) -> list:
    """
    This function takes a list and returns a new list with the empty strings removed.

    Args:
        list_with_empty_strings (list): List with empty strings

    Returns:
        list: List with empty strings removed
    """
    return [item for item in list_with_empty_strings if item]


def multi_join(primary_df: pd.DataFrame, join_instructions: list) -> pd.DataFrame:
    """
    Perform multiple joins on a DataFrame given a list of join instructions.

    Args:
        primary_df (pd.DataFrame): Primary DataFrame
        join_instructions (list): List of join instructions. Each instruction should be a
                                list with the following format:
                                [df_to_join, join_field, index_field]
    
    Returns:
        pd.DataFrame: Resulting DataFrame after performing multiple joins
    """

    gumbo_client = Client()

    result_df = primary_df
    for instruction in join_instructions:
        assert (
            len(instruction.split(", ")) % 3 == 0
        ), "Join instruction must have 3 parts in [df_to_join, join_field, index_field] format"
        secondary_df_name = instruction.split(", ")[0]
        joined_on = instruction.split(", ")[1]
        index_field = instruction.split(", ")[2]
        secondary_df = gumbo_client.get(secondary_df_name)
        result_df = result_df.join(
            secondary_df.set_index(index_field),
            on=joined_on,
            how="left",
            lsuffix=(secondary_df_name + "."),
        )

    return result_df


def gumbo_df_preprocessing(
    data_dictionary_table_df: pd.DataFrame, gumbo_table_df
) -> pd.DataFrame:
    """
    This function takes a DataFrame containing the data dictionary for a single table and returns a DataFrame containing the data from the Gumbo table.

    Args:
        data_dictionary_table_df (pd.DataFrame): DataFrame containing the data dictionary for a single table
    
    Returns:
        pd.DataFrame: DataFrame containing the filtered data from the Gumbo table
    """
    # Get the column names from the 'gumbo_column_name' column and remove the first part of the string if there is a dot
    gumbo_column_names = data_dictionary_table_df["gumbo_column_name"].tolist()
    gumbo_column_names = [get_second_part_of_string(s) for s in gumbo_column_names]

    # Get the column names from the 'release_column_name' column
    release_column_names = data_dictionary_table_df["release_column_name"].tolist()

    # Get the join instructions from the 'joined_on' column and filter out empty strings
    join_instructions = data_dictionary_table_df["joined_on"].tolist()
    join_instructions = filter_empty_strings(join_instructions)

    # Perform multiple joins on a DataFrame given a list of join instructions
    df = multi_join(gumbo_table_df, join_instructions)

    missing_columns = set(gumbo_column_names) - set(df.columns)
    assert (
        len(missing_columns) == 0
    ), f"Joined dataframe has missing columns: {', '.join(missing_columns)}"

    # Filter out the columns that are not in the 'gumbo_column_names' list
    df = df[gumbo_column_names]

    # Rename the columns to release_column_names
    df.columns = release_column_names

    return df


def get_model_ids(quarterly_release_dataset_id: str) -> set():
    """
        Get the model ids from the quarterly datasets
        Args:
            quarterly_release_dataset_id (str): Dataset id of the quarterly release
        Returns:
            set: Set of model ids
        """

    taiga_client_v3 = create_taiga_client_v3()

    taiga_ids_to_check = {
        f"{quarterly_release_dataset_id}/{f}": column
        for f, column in quarterly_files_to_check.items()
    }

    model_ids = set()
    for taiga_id, column in tqdm(
        taiga_ids_to_check.items(), desc="Processing Taiga IDs", unit="id"
    ):
        print("taiga_id", taiga_id)
        df = taiga_client_v3.get(taiga_id)
        if re.match("ACH-[0-9]*", str(df.index[0])):
            model_ids.update(set(df.index))
        elif re.match("ACH-[0-9]*", str(df.columns[0])):
            model_ids.update(set(df.columns))
        else:
            assert column in df.columns, f"Missing {column} in {df.columns}"
            model_ids.update(set(df[column]))

    return model_ids


def get_model_condition_ids(quarterly_release_dataset_id: str) -> set():
    """
    Get the model condition ids from the quarterly release dataset

    Args:
        quarterly_release_dataset_id (str): Dataset id of the quarterly release

    Returns:
        set: Set of model condition ids
    """

    taiga_client_v3 = create_taiga_client_v3()

    omics_profiles_taiga_id = f"{quarterly_release_dataset_id}/OmicsProfiles"
    screen_sequence_map_taiga_id = f"{quarterly_release_dataset_id}/ScreenSequenceMap"

    print(f"Importing omics_profiles_taiga_id: {omics_profiles_taiga_id}")
    omics_profiles = taiga_client_v3.get(omics_profiles_taiga_id)

    print(f"Importing screen_sequence_map_taiga_id: {screen_sequence_map_taiga_id}")
    screen_sequence_map = taiga_client_v3.get(screen_sequence_map_taiga_id)

    model_condition_ids = set(omics_profiles["ModelCondition"]) | set(
        screen_sequence_map["ModelConditionID"]
    )
    return model_condition_ids


def _update_description(yaml_filename: str, filename: str, description: str):

    with open(yaml_filename, "rt") as fd:
        yaml_content = yaml.safe_load(fd)

    files_by_name = {file["name"]: file for file in yaml_content["files"]}
    files_by_name[filename]["description"] = description

    with open(yaml_filename, "wt") as fd:
        yaml.dump(yaml_content, fd)


def update_readme_content(
    yaml_filename: str, data_dictionary_df: pd.DataFrame, filename: str, prologue: str
) -> None:
    """
    This function takes a DataFrame containing the data dictionary and updates README yaml.

    Args:
        yaml_filename: path to YAML file to update
        data_dictionary_df (pd.DataFrame): DataFrame containing the data dictionary
        filename: Name of the file whose description is being updated
    """
    # Get the column names from the 'release_column_name' column
    column_names = data_dictionary_df["release_column_name"].tolist()

    # Get the column descriptions from the 'column_description' column
    column_description = data_dictionary_df["column_description"].tolist()

    buffer = io.StringIO()
    buffer.write(prologue + "\n\n")
    for name, desc in zip(column_names, column_description):
        buffer.write(f"- {name}: {desc}\n\n")

    _update_description(yaml_filename, filename, buffer.getvalue())
