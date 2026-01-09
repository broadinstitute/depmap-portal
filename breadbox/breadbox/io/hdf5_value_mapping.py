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


def get_encoder_function(value_type: ValueType, allowed_values: Optional[List[str]]):
    if value_type == ValueType.categorical:
        return lambda df: encode_categorical_df(df, allowed_values)
    elif value_type == ValueType.continuous:
        return None
    elif value_type == ValueType.list_strings:
        return encode_list_strings_df
    else:
        raise NotImplementedError(f"Unknown type: {value_type}")


def get_decoder_function(value_type: ValueType, allowed_values: Optional[List[str]]):
    if value_type == ValueType.categorical:
        return lambda df: decode_categorical_df(df, allowed_values)
    elif value_type == ValueType.continuous:
        return None
    elif value_type == ValueType.list_strings:
        return decode_list_strings_df
    else:
        raise NotImplementedError(f"Unknown type: {value_type}")


## support for ValueType.categorical


def decode_categorical_df(df: pd.DataFrame, allowed_values: List[str]):
    # the implementation I'm reworking was doing this -- but why?
    allowed_values_ = allowed_values + [None]
    df = df.astype(int)
    return df.map(lambda x: allowed_values_[x])


def encode_categorical_df(df: pd.DataFrame, allowed_values: List) -> pd.DataFrame:
    """Given a dataframe of strings, creates a dataframe of integers by looking up the index of each string in allowed_values. If the string isn't in allowed_Values than a FileValidationError is raised"""
    # NOTE: Boolean values turned to string
    lower_allowed_values = [str(x).lower() for x in allowed_values if x is not None] + [
        None
    ]  # Data values can include missing values

    lower_df = df.map(lambda x: None if pd.isna(x) else str(x).lower())

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
    int_df = lower_df.map(lambda x: lower_allowed_values_map[x])

    int_df = int_df.astype(int)

    return int_df


## support for ValueType.list_strings

example_list_string = '["x", "y"]'


def _parse_list_strings(val: str):
    if len(val) == 0:
        return None

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

    return deserialized_str_list


def _parse_list_strings_or_na(val):
    if pd.isnull(val):
        return pd.NA
    else:
        return _parse_list_strings(val)


def encode_list_strings_df(df: pd.DataFrame):
    # attempt the parsing, and re-encode the df as string to canonicalize the format
    parsed = df.map(_parse_list_strings_or_na)
    canonicalized = parsed.map(lambda x: json.dumps(x) if isinstance(x, list) else "")
    return canonicalized


def decode_list_strings_df(df: pd.DataFrame) -> pd.DataFrame:
    return df.map(_parse_list_strings_or_na)
