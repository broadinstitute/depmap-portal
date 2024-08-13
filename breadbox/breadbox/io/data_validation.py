from dataclasses import dataclass
from typing import Any, BinaryIO, Dict, List, Optional, Sequence, Union
import json

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype, is_string_dtype, is_bool_dtype
import pandera as pa
from pandera.errors import SchemaError
from fastapi import UploadFile
from sqlalchemy import and_, or_


from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import (
    AnnotationType,
    TabularCell,
    ValueType,
    DimensionType,
    TabularColumn,
)
from breadbox.io.filestore_crud import save_dataset_file
from breadbox.schemas.custom_http_exception import (
    FileValidationError,
    AnnotationValidationError,
)
from breadbox.schemas.dataset import ColumnMetadata

pd.set_option("mode.use_inf_as_na", True)

dimension_label_df_schema = pa.DataFrameSchema(
    {
        "index": pa.Column(int, nullable=False, coerce=True, unique=True,),
        "given_id": pa.Column(
            str, nullable=False, coerce=True, unique=True, required=False
        ),
    },
    index=None,
    strict=True,
)


def validate_all_columns_have_types(
    cols: List[str], annotation_type_mapping: Dict[str, AnnotationType],
):
    extra_columns = set(annotation_type_mapping.keys()).difference(cols)
    missing_columns = set(cols).difference(annotation_type_mapping.keys())
    if len(extra_columns) > 0:
        raise AnnotationValidationError(
            f"Annotation type mapping referenced columns which were not present: { ','. join(extra_columns)}"
        )

    if len(missing_columns) > 0:
        raise AnnotationValidationError(
            f"Annotation type mapping did not have types for the following columns: { ','. join(missing_columns)}"
        )


def map_annotation_type_to_pandas_dtype(annotation_type: AnnotationType):
    annotation_type_to_pandas_type_mappings = {
        AnnotationType.continuous: "float",
        AnnotationType.categorical: "category",
        AnnotationType.binary: "boolean",
        AnnotationType.text: "string",
        AnnotationType.list_strings: "string",
    }
    return annotation_type_to_pandas_type_mappings.get(annotation_type)


def _validate_dimension_type_metadata_file(
    metadata_file: Optional[UploadFile],
    annotation_type_mapping: Dict[str, AnnotationType],
    dimension_type_name: str,
    id_column: str,
) -> Optional[pd.DataFrame]:
    if metadata_file is None:
        return None

    bytes_buf = metadata_file.file
    cols = pd.read_csv(bytes_buf, nrows=0).columns
    if id_column not in cols:
        raise FileValidationError(
            f"Your dimension type '{dimension_type_name}' has id_column '{id_column}'. Please make sure your file has '{id_column}' column."
        )
    if not cols.is_unique:
        raise FileValidationError(
            f"Please make sure your file has unique column names."
        )

    validate_all_columns_have_types(cols, annotation_type_mapping)

    bytes_buf.seek(0)

    annotation_type_mapping_to_pandas_dtypes = {}
    for col in annotation_type_mapping:
        annotation_type_mapping_to_pandas_dtypes[
            col
        ] = map_annotation_type_to_pandas_dtype(annotation_type_mapping[col])

    try:
        df = pd.read_csv(bytes_buf, dtype=annotation_type_mapping_to_pandas_dtypes)
        # Replace to None because NaN  values can't be stored in sqlite db
        df = df.replace({np.nan: None})
    except ValueError as e:
        raise AnnotationValidationError(str(e))

    # make sure id column is unique
    if not df[id_column].is_unique:
        raise FileValidationError(f"Make sure all ids in {id_column} are unique.")

    # make sure id column have no missing info
    if df[id_column].isnull().values.any():
        raise FileValidationError(
            f"Make sure there are no missing ids in the {id_column} column."
        )

    return df


def _validate_data_value_type(
    df: pd.DataFrame, value_type: ValueType, allowed_values: Optional[List]
):
    if value_type == ValueType.categorical:
        assert (
            allowed_values
        ), "Allowed values must be specified for categorical datasets."
        # Either string or boolean values allowed
        if not all(
            [
                is_string_dtype((df[col].dtypes) or is_bool_dtype(df[col].dtypes))
                for col in df.columns
            ]
        ):
            raise FileValidationError(
                "All values must be strings or booleans for categorical datasets."
            )
        # to make it not case-sensitive, convert all to lower case

        lower_df = df.applymap(lambda x: None if pd.isna(x) else str(x).lower())
        # NOTE: Boolean values turned to string
        lower_allowed_values = [
            str(x).lower() for x in allowed_values if x is not None
        ] + [
            None
        ]  # Data values can include missing values
        if not lower_df.isin(lower_allowed_values).all().all():
            raise FileValidationError(
                f"Value must be in list of allowed values: {allowed_values}"
            )
        # Convert categories to ints for more optimal storage
        lower_allowed_values_map = {x: i for i, x in enumerate(lower_allowed_values)}
        int_df = lower_df.applymap(lambda x: lower_allowed_values_map[x])

        int_df = int_df.astype(int)
        return int_df
    else:
        if not all([is_numeric_dtype(df[col].dtypes) for col in df.columns]):
            raise FileValidationError(
                "All values must be numeric for continuous datasets."
            )
        return df.astype(np.float64)


def _read_parquet(file: BinaryIO, value_type: ValueType) -> pd.DataFrame:
    df = pd.read_parquet(file, use_nullable_dtypes=True)  # pyright: ignore

    # the first column will be treated as the index. Make sure it's of type string
    df[df.columns[0]] = df[df.columns[0]].astype("string")

    # parquet files have the types encoded in the file, so we'll convert after the fact
    if value_type == ValueType.continuous:
        dtype = "Float64"
    elif value_type == ValueType.categorical:
        dtype = "string"
    else:
        raise ValueError(f"Invalid value type: {value_type}")

    df[df.columns[1:]] = df[df.columns[1:]].astype(dtype)
    return df


from typing import cast


def _read_csv(file: BinaryIO, value_type: ValueType) -> pd.DataFrame:
    cols = pd.read_csv(file, nrows=0).columns

    if value_type == ValueType.continuous:
        dtypes_ = dict(zip(cols, ["string"] + (["Float64"] * (len(cols) - 1))))
    elif value_type == ValueType.categorical:
        dtypes_ = dict(zip(cols, ["string"] * len(cols)))
    else:
        raise ValueError(f"Invalid value type: {value_type}")

    dtypes = cast(Dict[str, str], dtypes_)

    file.seek(0)

    df = pd.read_csv(file, dtype=dtypes)  # pyright: ignore

    return df


def _validate_data_file(
    df: pd.DataFrame, value_type: ValueType, allowed_values: Optional[List[str]],
) -> pd.DataFrame:
    """
    Validates the data values against it's given value_type.
    Checks if all features and samples in dataset are unique.
    """

    # make sure all the values in df conform to value_type
    df = _validate_data_value_type(df, value_type, allowed_values)

    verify_unique_rows_and_cols(df)

    return df


def verify_unique_rows_and_cols(df: pd.DataFrame):
    duplicated_columns = df.columns[df.columns.duplicated()]
    if len(duplicated_columns) > 0:
        raise FileValidationError(
            f"Encountered duplicate column names (Feature IDs): {_format_abridged_list(duplicated_columns)}"
        )

    duplicated_index = df.index[df.index.duplicated()]
    if len(duplicated_index) > 0:
        raise FileValidationError(
            f"Encountered duplicate row indices (Sample IDs): {_format_abridged_list(duplicated_index)}"
        )


def _format_abridged_list(values, max_elements=10):
    if len(values) > max_elements:
        return f"{', '.join(values[:max_elements//2])}, ..., {', '.join(values[-max_elements//2:])}"
    else:
        return f"{', '.join(values)}"


def _warnings_dimensions_not_in_metadata(
    dimensions: Sequence[str], dimension_type_dimensions: Sequence[str]
):
    """
    When users upload a dataset, the feature IDs or sample IDs will be verified to exist in the set of IDs enumerated
    in the Feature Type Metadata or the Sample Type Metadata respectively. If an ID is not present, this will be reported
    as a warning, but the deposit will proceed.
    """
    warnings = []
    warnings.extend(set(dimensions).difference(dimension_type_dimensions))
    return warnings


def _get_dimension_type_given_ids(
    db: SessionWithUser, dimension_type: DimensionType
) -> list[str]:
    """
    Get the full list of dimension type given IDs by reading the ID column 
    of the dimension type metadata table. 
    """
    given_ids = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_id == dimension_type.dataset_id,
                TabularColumn.dataset_dimension_type == dimension_type.name,
                TabularColumn.given_id == dimension_type.id_column,
            )
        )
        .with_entities(TabularCell.value)
    ).all()
    return [x for x, in given_ids]


@dataclass
class DimensionLabelsAndWarnings:
    given_id_to_index: pd.DataFrame
    warnings: List[str]


@dataclass
class DataframeValidatedFile:
    feature_given_id_and_index: pd.DataFrame
    sample_given_id_and_index: pd.DataFrame
    feature_warnings: List[str]
    sample_warnings: List[str]


def _get_dimension_labels_and_warnings(
    db: SessionWithUser,
    given_ids: Sequence[str],
    dimension_type: Optional[DimensionType],
) -> DimensionLabelsAndWarnings:

    given_id_to_index = pd.DataFrame(
        {"index": range(len(given_ids)), "given_id": list(given_ids)}
    )

    if dimension_type and dimension_type.dataset_id:
        given_ids_from_metadata = _get_dimension_type_given_ids(db, dimension_type)

        dimension_warnings = _warnings_dimensions_not_in_metadata(
            given_id_to_index["given_id"].to_list(), given_ids_from_metadata,
        )
    else:
        # If there is no metadata, then the IDs will be used as the labels
        dimension_warnings = []

    return DimensionLabelsAndWarnings(given_id_to_index, dimension_warnings)


# TODO:Remove and replace with above
def _validate_dataset_dimensions(
    db: SessionWithUser,
    data_df: pd.DataFrame,
    feature_type: Optional[DimensionType],
    sample_type: DimensionType,
) -> DataframeValidatedFile:

    sample_given_id_to_index = pd.DataFrame(
        {"index": range(len(data_df.index)), "given_id": list(data_df.index)}
    )
    feature_given_id_to_index = pd.DataFrame(
        {"index": range(len(data_df.columns)), "given_id": list(data_df.columns)}
    )

    # If there is a specified type, get the labels from there
    if feature_type and feature_type.dataset_id:
        given_ids_from_metadata = _get_dimension_type_given_ids(db, feature_type)
        feature_warnings = _warnings_dimensions_not_in_metadata(
            feature_given_id_to_index["given_id"].to_list(), given_ids_from_metadata,
        )
    else:
        # if there's no metadata, there's nothing to check against, so no point to warnings
        feature_warnings = []

    if sample_type and sample_type.dataset_id:
        given_ids_from_metadata = _get_dimension_type_given_ids(db, sample_type)

        sample_warnings = _warnings_dimensions_not_in_metadata(
            sample_given_id_to_index["given_id"].to_list(), given_ids_from_metadata,
        )
    else:
        # If there is no metadata, then the IDs will be used as the labels
        feature_warnings = []
        # if there's no metadata, there's nothing to check against, so no point to warnings
        sample_warnings = []

    feature_given_id_to_index = dimension_label_df_schema.validate(
        feature_given_id_to_index
    )
    sample_given_id_to_index = dimension_label_df_schema.validate(
        sample_given_id_to_index
    )

    return DataframeValidatedFile(
        feature_given_id_to_index,
        sample_given_id_to_index,
        feature_warnings,
        sample_warnings,
    )


def validate_and_upload_dataset_files(
    db: SessionWithUser,
    dataset_id: str,
    data_file: UploadFile,
    feature_type: Optional[DimensionType],
    sample_type: Optional[DimensionType],
    filestore_location: str,
    value_type: ValueType,
    allowed_values: Optional[List[str]],
    data_file_format: str = "csv",
) -> DataframeValidatedFile:

    if data_file_format == "csv":
        unchecked_df = _read_csv(data_file.file, value_type)
    elif data_file_format == "parquet":
        unchecked_df = _read_parquet(data_file.file, value_type)
    else:
        raise FileValidationError(
            f'data file format must either be "csv" or "parquet" but was "{data_file_format}"'
        )

    unchecked_df.set_index(unchecked_df.columns[0], inplace=True)

    data_df = _validate_data_file(unchecked_df, value_type, allowed_values,)

    dataframe_validated_dimensions = _validate_dataset_dimensions(
        db, data_df, feature_type, sample_type
    )

    # TODO: Move save function to api layer. Need to make sure the db save is successful first
    save_dataset_file(dataset_id, data_df, filestore_location)

    return dataframe_validated_dimensions


def validate_dimension_type_metadata(
    metadata_file: UploadFile,
    annotation_type_mapping: Dict[str, AnnotationType],
    dimension_type_name: str,
    id_column: str,
):
    metadata_df = _validate_dimension_type_metadata_file(
        metadata_file, annotation_type_mapping, dimension_type_name, id_column
    )
    assert metadata_df is not None

    if "label" not in metadata_df.columns:
        raise FileValidationError(
            "Please make sure your metadata file has 'label' column."
        )
    if not metadata_df["label"].is_unique:
        raise FileValidationError("Make sure all labels are unique.")
    if metadata_df["label"].isnull().values.any():
        raise FileValidationError(
            f"Make sure there are no missing labels in the 'label' column."
        )
    if (
        "label" not in annotation_type_mapping
        or annotation_type_mapping["label"] != AnnotationType.text
    ):
        raise FileValidationError("Label annotation must be of type 'text'!")
    metadata_df = process_annotation_list_values(metadata_df, annotation_type_mapping)

    return metadata_df


def process_annotation_list_values(
    df: pd.DataFrame, annotation_type_mapping: Dict[str, AnnotationType]
):
    annotation_col_list = [
        col_name
        for (col_name, annotation_type_value) in annotation_type_mapping.items()
        if annotation_type_value == AnnotationType.list_strings
    ]

    def parse_list_val(val):
        if val is not None:
            try:
                deserialized_str_list = json.loads(val)
            except Exception as e:
                raise FileValidationError(
                    f'Unable to parse value {val} for annotation. Make sure all values are in the format ["val1", "val2"]!'
                ) from e

            if not all(isinstance(x, str) for x in deserialized_str_list):
                raise FileValidationError(
                    f"All values in list {deserialized_str_list} must be a string"
                )

            return json.dumps(deserialized_str_list)
        else:
            return val

    for annotation_col in annotation_col_list:
        annotation_series = df[annotation_col]

        series = annotation_series.apply(parse_list_val)

        df[annotation_col] = series
    return df


##### NEW DATASET UPLOAD FUNCTIONS #####


def read_and_validate_matrix_df(
    file_path: str,
    value_type: ValueType,
    allowed_values: Optional[List[str]],
    data_file_format: str,
) -> pd.DataFrame:
    with open(file_path, "rb") as fd:
        if data_file_format == "csv":
            df = _read_csv(fd, value_type)
        elif data_file_format == "parquet":
            df = _read_parquet(fd, value_type)
        else:
            raise FileValidationError(
                f"data_file_format was unrecognized: {data_file_format}"
            )

    # now make the first column into the index
    df.set_index(df.columns[0], inplace=True)

    # for categorical values, this will map strings to integers (representing the index into allowed_values)
    df = _validate_data_value_type(df, value_type, allowed_values)

    verify_unique_rows_and_cols(df)

    return df


def read_and_validate_tabular_df(
    file_path: str,
    columns_metadata: Dict[str, ColumnMetadata],
    dimension_type_identifier: str,
):
    def annotation_type_to_pandas_column_type(annotation_type: AnnotationType):
        annotation_type_to_pandas_type_mappings = {
            AnnotationType.continuous: pd.Float64Dtype(),
            AnnotationType.categorical: pd.CategoricalDtype(),
            AnnotationType.binary: pd.BooleanDtype(),
            AnnotationType.text: pd.StringDtype(),
            AnnotationType.list_strings: pd.StringDtype(),
        }
        dtype = annotation_type_to_pandas_type_mappings.get(annotation_type)
        assert dtype is not None
        return dtype

    def can_parse_list_strings(val):
        example_list_string = '["x", "y"]'
        if val is not None and not pd.isnull(val):
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
            return True
        else:
            return True

    def get_checks_for_col(annotation_type: AnnotationType):
        checks = []
        if annotation_type == AnnotationType.list_strings:
            # Checks format of list of strings value is valid
            checks.extend(
                [
                    pa.Check.str_startswith("[", error={"Must start with '[']"}),
                    pa.Check.str_endswith("]"),
                    pa.Check(can_parse_list_strings, element_wise=True),
                ]
            )
        return checks

    schema = pa.DataFrameSchema(
        {
            k: pa.Column(
                annotation_type_to_pandas_column_type(
                    v.col_type
                ),  # annotation_type_to_pandera_column_type(v.col_type),
                nullable=False if dimension_type_identifier == k else True,
                checks=get_checks_for_col(v.col_type),
                unique=dimension_type_identifier == k,
            )
            for k, v in columns_metadata.items()
        },
        index=None,
        strict=True,  # Df only contains columns in schema
    )

    # NOTE: missing values are denoted as pd.NA
    df = pd.read_csv(
        file_path,
        dtype={
            k: annotation_type_to_pandas_column_type(v.col_type)
            for k, v in columns_metadata.items()
        },
    )
    try:
        validated_df = schema.validate(df)
    except SchemaError as schema_error:
        error_msg = str(schema_error)
        if schema_error.check is not None:
            if (
                hasattr(schema_error.check, "name")
                and schema_error.check.name == "can_parse_list_strings"
            ):
                if schema_error.failure_cases is not None and hasattr(
                    schema_error.failure_cases, "failure_case"
                ):
                    error_msg = str(schema_error.failure_cases.failure_case[0])
            if isinstance(schema_error.check, str):
                error_msg = schema_error.check
            # error message returned for failed json deserialization is long so truncate it

        raise FileValidationError(error_msg) from schema_error
    return validated_df
