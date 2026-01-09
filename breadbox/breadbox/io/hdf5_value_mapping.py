from typing import List, Optional

from breadbox.schemas.custom_http_exception import FileValidationError
import pandas as pd
import json

from breadbox.schemas.dataset import AnnotationType, ValueType

# When storing matrices, we read in values from a DataFrame, and write out an HDF5 file. However, there are cases where we encode the contents of the HDF5 differently then the value we read. Similarly, when we read the value out of the HDF5 file, we may want to convert it again.
# For example for ValueType.categorical (where allowed_values = ["a", "b"])
#    original value from source df: "a" (python type is str)
#    value stored in HDF5 file: 0.0 (python type is float)
#    when value read from HDF5: "a" (python type is str)
#
# Similarly, for list_string:
#    original value from source df: "[\"a\", \"b\"]" (python type is str)
#    value stored in HDF5 file: "[\"a\", \"b\"]" (python type is str)
#    when value read from HDF5: ["a", "b"] (python type is list)


def get_value_to_hdf5_mapping(
    value_type: ValueType, allowed_values: Optional[List[str]]
):
    if value_type == ValueType.categorical:
        return lambda df: categorical_to_int_encoded_df_or_raise(df, allowed_values)
    elif value_type == ValueType.continuous:
        return None
    elif value_type == ValueType.list_strings:
        return validate_list_strings_and_return_unchanged
    else:
        raise NotImplementedError(f"Unknown type: {value_type}")


def get_hdf5_to_value_mapping(
    value_type: ValueType, allowed_values: Optional[List[str]]
):
    if value_type == ValueType.categorical:
        return lambda df: int_encoded_to_categorical_str_df(df, allowed_values)
    elif value_type == ValueType.continuous:
        return None
    elif value_type == ValueType.list_strings:
        return json_loads_per_element
    else:
        raise NotImplementedError(f"Unknown type: {value_type}")


def int_encoded_to_categorical_str_df(df: pd.DataFrame, allowed_values: List[str]):
    # the implementation I'm reworking was doing this -- but why?
    allowed_values_ = allowed_values + [None]
    df = df.astype(int)
    return df.map(lambda x: allowed_values_[x])


def json_loads_per_element(df: pd.DataFrame):
    # NOTE: String data in HDF5 datasets is read as bytes by default
    # len of byte encoded empty string should be 0
    return df.map(lambda x: json.loads(x) if len(x) != 0 else None)


def categorical_to_int_encoded_df_or_raise(
    df: pd.DataFrame, allowed_values: List
) -> pd.DataFrame:
    """Given a dataframe of strings, creates a dataframe of integers by looking up the index of each string in allowed_values. If the string isn't in allowed_Values than a FileValidationError is raised"""
    # NOTE: Boolean values turned to string
    lower_allowed_values = [str(x).lower() for x in allowed_values if x is not None] + [
        None
    ]  # Data values can include missing values

    lower_df = df.applymap(lambda x: None if pd.isna(x) else str(x).lower())

    present_values = set(lower_df.values.flatten())
    unexpected_values = present_values.difference(lower_allowed_values)
    if len(unexpected_values) > 0:
        sorted_unexpected_values = sorted(unexpected_values)
        examples = ", ".join([repr(x) for x in sorted_unexpected_values[:10]])
        if len(sorted_unexpected_values) > 10:
            examples += ", ..."
        raise FileValidationError(
            f"Found values (examples: {examples}) not in list of allowed values: {allowed_values}"
        )

    # Convert categories to ints for more efficient storage
    lower_allowed_values_map = {x: i for i, x in enumerate(lower_allowed_values)}
    int_df = lower_df.applymap(lambda x: lower_allowed_values_map[x])

    int_df = int_df.astype(int)

    return int_df


def _parse_list_strings(val):
    example_list_string = '["x", "y"]'
    try:
        deserialized_str_list = json.loads(val)
    except Exception as e:
        raise FileValidationError(
            f"Value: {val} must be able to be deserialized into a list. Please make sure values for columns of type list_strings are a stringified list (ex: {example_list_string})"
        ) from e

    if not isinstance(deserialized_str_list, list):
        raise FileValidationError(
            f"Value: {val} must be able to be deserialized into a list. Please make sure values for columns of type list_strings are a stringified list (ex: {example_list_string})"
        )

    if not all(isinstance(x, str) for x in deserialized_str_list):
        raise FileValidationError(
            f"All values in {deserialized_str_list} must be a string (ex: {example_list_string})"
        )


def _validate_list_strings(val):
    if not pd.isnull(val):
        _parse_list_strings(val)
        return val
    else:
        return pd.NA


def validate_list_strings_and_return_unchanged(df: pd.DataFrame):
    # attempt the parsing, but return the unchanged inputs
    df.applymap(_validate_list_strings)
    return df


def map_values_to_list_of_strings(df: pd.DataFrame) -> pd.DataFrame:
    return df.applymap(_validate_list_strings)
