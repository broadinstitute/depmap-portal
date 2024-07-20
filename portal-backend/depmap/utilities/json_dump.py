import pandas as pd
import pandera as pa
from flask import jsonify


from flask import current_app
import json
import numpy as np
import math


def _corece_nan_to_none(x):
    if isinstance(x, float):
        if math.isfinite(x):
            return x
        else:
            return None
    else:
        return x


class Encoder(json.JSONEncoder):
    def default(self, obj):
        if pd.isna(obj):
            return None
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            value = float(obj)
            if np.isfinite(value):
                return value
            else:
                return None
        return super(Encoder, self).default(obj)


def jsonify_df(df: pd.DataFrame, schema: pa.DataFrameSchema):
    """
    Serializes a pandas DataFrame as a json response and encode the data frame as
    a dictionary of column_name -> list of values. (Omitting index)

    In the process it also will replace NAs with
    None.

    This is a common pattern that we use, so putting the logic into a shared utility method.
    """

    # replace all NAs to None (has side effect of turning all columns to type object)
    # df = df.where(pd.notnull(df), None)

    # validate the dataframe before reporting it out and fix up any wrong datatypes
    schema.validate(df)

    # based on flask.jsonify
    indent = None
    separators = (",", ":")

    if current_app.config["JSONIFY_PRETTYPRINT_REGULAR"] or current_app.debug:
        indent = 2
        separators = (", ", ": ")

    data = {
        column: [_corece_nan_to_none(x) for x in df[column]]
        for column in schema.columns
    }
    return current_app.response_class(
        json.dumps(
            data, indent=indent, separators=separators, cls=Encoder, allow_nan=False
        )
        + "\n",
        mimetype=current_app.config["JSONIFY_MIMETYPE"],
    )

    return jsonify(data)
