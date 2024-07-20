import pandas as pd
from depmap.utilities.json_dump import jsonify_df
import pandera as pa


def test_json_dump(app):
    schema = pa.DataFrameSchema(
        columns={
            "str": pa.Column(dtype="string", nullable=True),
            "float": pa.Column(dtype="Float64", nullable=True),
            "int": pa.Column(dtype="Int64", nullable=True),
        },
        coerce=True,
    )

    df = pd.DataFrame(
        {"str": ["a", "b", pd.NA], "float": [1.0, pd.NA, 2.0], "int": [1, 2, pd.NA]}
    )
    df = df.convert_dtypes()

    response = jsonify_df(df, schema)
    print(response)
    assert response.json == {
        "str": ["a", "b", None],
        "float": [1.0, None, 2.0],
        "int": [1, 2, None],
    }
