import pandas as pd

from breadbox.io.data_validation import (
    verify_unique_rows_and_cols,
    read_and_validate_matrix_df,
    ColumnMetadata,
    AnnotationType,
    FileValidationError,
    read_and_validate_matrix_df,
    _validate_tabular_df_schema,
    ValueType,
)
import pytest


def test_verify_unique_rows_and_cols():
    # duplicate row index failure
    with pytest.raises(FileValidationError) as ex:
        verify_unique_rows_and_cols(
            pd.DataFrame(0, columns=["C1", "C2"], index=["A", "B", "A"])  # type: ignore[arg-type]
        )
    assert "Encountered duplicate row indices (Sample IDs): A" == str(ex.value.detail)

    # duplicate col failure
    with pytest.raises(FileValidationError) as ex:
        verify_unique_rows_and_cols(
            pd.DataFrame(0, columns=["C1", "C2", "C1"], index=["A", "B", "C"])  # type: ignore[arg-type]
        )
    assert "Encountered duplicate column names (Feature IDs): C1" == str(
        ex.value.detail
    )

    # no problems
    verify_unique_rows_and_cols(
        pd.DataFrame(0, columns=["C1", "C2", "C3"], index=["A", "B", "C"])  # type: ignore[arg-type]
    )

    # now check a long error to make sure it shortens it
    # make 20 duplicated columns
    with pytest.raises(FileValidationError) as ex:
        columns = [f"C{i}" for i in range(20)]
        verify_unique_rows_and_cols(
            pd.DataFrame(0, columns=columns + columns, index=["A", "B", "C"])  # type: ignore[arg-type]
        )
    assert (
        "Encountered duplicate column names (Feature IDs): C0, C1, C2, C3, C4, ..., C15, C16, C17, C18, C19"
        == str(ex.value.detail)
    )


file_counter = 0


def _to_csv(tmpdir, df, index=True):
    global file_counter
    # just need a unique filename
    file_counter += 1
    filename = str(tmpdir.join(f"{file_counter}.csv"))
    df.to_csv(filename, index=index)
    return filename


def test_read_and_validate_matrix_df(tmpdir):
    def to_csv(*args, **kwargs):
        return _to_csv(tmpdir, *args, **kwargs)

    # parse this matrix as categorical
    df = read_and_validate_matrix_df(
        to_csv(pd.DataFrame("3", columns=["C1", "C2"], index=["A", "B"])),  # type: ignore[arg-type]
        ValueType.categorical,
        ["2", "3"],
        "csv",
    )

    # this make look funny because we read in a matrix of all 3s but the value came back as 1
    # this is because the way we encode categorical data is by storing the _index_ of the value in _allowed_values_
    # so in this case, 1 -> "3"
    assert df["C1"].to_list() == [1, 1]

    # parse this matrix as floats
    df = read_and_validate_matrix_df(
        to_csv(pd.DataFrame("0", columns=["C1", "C2"], index=["A", "B"])),  # type: ignore[arg-type]
        ValueType.continuous,
        None,
        "csv",
    )

    assert df["C1"].to_list() == [0.0, 0.0]

    # make sure the index and columns are read as strings even if they're numeric values
    df = read_and_validate_matrix_df(
        to_csv(pd.DataFrame("0", columns=["10", "11"], index=["0", "1"])),  # type: ignore[arg-type]
        ValueType.continuous,
        None,
        "csv",
    )
    assert df.index.to_list() == ["0", "1"]
    assert df.columns.to_list() == ["10", "11"]


def test_validate_tabular_df_schema(tmpdir):
    def to_csv(*args, **kwargs):
        return _to_csv(tmpdir, *args, **kwargs)

    # fewer edge cases with tables. Just exercise columns with numbers to see if
    # anything weird happens
    df = _validate_tabular_df_schema(
        to_csv(pd.DataFrame("0", columns=["13", "10", "11"], index=[1]), index=False),  # type: ignore[arg-type]
        {
            "10": ColumnMetadata(col_type=AnnotationType.text),
            "13": ColumnMetadata(col_type=AnnotationType.text),
            "11": ColumnMetadata(col_type=AnnotationType.continuous, units="unit"),
        },
        "13",
    )

    assert df["10"].to_list() == ["0"]
    assert df["13"].to_list() == ["0"]
    assert df["11"].to_list() == [0.0]

    import json

    # didn't test parsing str lists, so do that here
    df = _validate_tabular_df_schema(
        to_csv(
            pd.DataFrame([["0", json.dumps(["1", "2"])]], columns=["ID", "list"]),  # type: ignore[arg-type]
            index=False,
        ),
        {
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "list": ColumnMetadata(col_type=AnnotationType.list_strings),
        },
        "ID",
    )

    assert df["ID"].to_list() == ["0"]
    # I think it's make sense for read_and_validate_tabular_df to parse the list column, but it doesn't today
    # so leaving it this way and just reflecting that in the test case
    assert df["list"].to_list() == ['["1", "2"]']

    df = _validate_tabular_df_schema(
        to_csv(
            pd.DataFrame(
                {
                    "ID": ["id1", "id2", "id3"],
                    "col1": [1, 2.1, 3],
                    "col2": ["1", "2.1", "3"],
                    "col3": [1, 1.1, 1],
                    "col4": [1, 0, 1],
                    "col5": ["1", "1.1", "1"],
                    "col6": [1, 0, 1],
                    "col7": [True, False, True],
                },
                columns=["ID", "col1", "col2", "col3", "col4", "col5", "col6", "col7"],  # type: ignore[arg-type]
            ),
            index=False,
        ),
        {
            "ID": ColumnMetadata(col_type=AnnotationType.text),
            "col1": ColumnMetadata(col_type=AnnotationType.continuous, units="units"),
            "col2": ColumnMetadata(col_type=AnnotationType.text),
            "col3": ColumnMetadata(col_type=AnnotationType.categorical),
            "col4": ColumnMetadata(col_type=AnnotationType.categorical),
            "col5": ColumnMetadata(col_type=AnnotationType.categorical),
            "col6": ColumnMetadata(col_type=AnnotationType.categorical),
            "col7": ColumnMetadata(col_type=AnnotationType.categorical),
        },
        "ID",
    )
    assert df["col1"].to_list() == [1.0, 2.1, 3.0]
    assert df["col1"].dtype == pd.Float64Dtype()
    assert df["col2"].to_list() == ["1", "2.1", "3"]
    assert df["col2"].dtype == pd.StringDtype()
    assert df["col3"].to_list() == ["1.0", "1.1", "1.0"]
    assert df["col3"].dtype == pd.CategoricalDtype(
        categories=["1.0", "1.1"], ordered=False
    )
    assert df["col4"].to_list() == [
        "1",
        "0",
        "1",
    ]  # TODO: This is an error where value type is changed. Noting here to address later
    assert df["col4"].dtype == pd.CategoricalDtype(categories=["0", "1"], ordered=False)
    assert df["col5"].to_list() == [
        "1",
        "1.1",
        "1",
    ]  # TODO: This is an error where value type is changed. Noting here to address later
    assert df["col5"].dtype == pd.CategoricalDtype(
        categories=["1", "1.1"], ordered=False
    )
    assert df["col6"].to_list() == ["1", "0", "1"]
    assert df["col6"].dtype == pd.CategoricalDtype(categories=["0", "1"])
    assert df["col7"].to_list() == ["True", "False", "True"]
    assert df["col7"].dtype == pd.CategoricalDtype(categories=["True", "False"])


def test_incorrect_typing_tabular_df_schema(tmpdir):
    def to_csv(*args, **kwargs):
        return _to_csv(tmpdir, *args, **kwargs)

    with pytest.raises(FileValidationError) as ex:
        _validate_tabular_df_schema(
            to_csv(
                pd.DataFrame(
                    {"ID": ["id1", "id2", "id3"], "col1": ["val1", "val2", "val3"]},
                    columns=["ID", "col1"],  # type: ignore[arg-type]
                ),
                index=False,
            ),
            {
                "ID": ColumnMetadata(col_type=AnnotationType.text),
                "col1": ColumnMetadata(
                    col_type=AnnotationType.continuous, units="unit"
                ),
            },
            "ID",
        )
    assert 'Unable to parse string "val1" at position 0' == ex.value.detail
