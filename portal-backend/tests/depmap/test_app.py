import pytest
from numpy import NaN
import pandas as pd
from flask import jsonify


def test_register_json_encoder(app):
    df = pd.DataFrame(
        {"col1": [-10, 2, 4, NaN], "col2": [1, 2, 4, 50]}, index=[0, 1, 2, 3]
    )

    with pytest.raises(ValueError) as e:
        jsonify(df.to_dict(orient="records"))
    assert "Out of range float values are not JSON compliant: nan" == str(e.value)
