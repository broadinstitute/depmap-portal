import pytest
from depmap.partials.data_frame_display import DataFrameDisplay


@pytest.mark.parametrize(
    "replace_underscores, make_title_case, expected",
    [
        (False, False, {}),
        # gene appears since we don't check if there is a before/after difference
        (True, False, {"r_squared": "r squared", "gene": "gene"}),
        (False, True, {"r_squared": "R_Squared", "gene": "Gene"}),
        (True, True, {"r_squared": "R Squared", "gene": "Gene"}),
    ],
)
def test_replace_underscores_make_title_case_options(
    app, replace_underscores, make_title_case, expected
):

    args = {}  # simulate not including the default args
    if not replace_underscores:
        args["replace_underscores"] = False
    if not make_title_case:
        args["make_title_case"] = False

    display = DataFrameDisplay(["r_squared", "gene"], **args)

    assert display.cols == ["r_squared", "gene"]
    assert display.renames == expected


def test_specified_renames():
    display = DataFrameDisplay(
        ["r_squared", "gene_symbol"], {"r_squared": "lowercase_with_underscores"}
    )

    # cols should be the old names
    assert display.cols == ["r_squared", "gene_symbol"]

    # specified rename should be applied
    # this specified rename should not have replace_underscores or make_title_case applied
    # the other column should have replace_underscores or make_title_case applied
    assert display.renames == {
        "r_squared": "lowercase_with_underscores",
        "gene_symbol": "Gene Symbol",
    }
