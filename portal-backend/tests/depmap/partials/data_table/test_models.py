from json import loads as json_loads

import pandas as pd
import pytest

from depmap.database import db
from depmap.partials.data_table.models import (
    DataTable,
    DataTableData,
    TableDisplay,
    TableDisplayRender,
    TableDisplayLink,
    TableDisplayEntityLink,
    TableDisplayButton,
    convert_js_row_col_to_index,
    convert_js_vars,
)

r_squared_value = 0.478
test_data = [
    {
        "gene": "one gene",
        "z_score": -0.2,
        "r_squared": r_squared_value,
        "other": "report",
    },
    {
        "gene": "another gene",
        "z_score": 0.6,
        "r_squared": r_squared_value,
        "other": "report",
    },
]
df = pd.DataFrame(test_data)


def test_convert_js_row_col_to_index():
    col_indices = {"rank_sh": 0, "z_score": 1}
    test_string = "row[rank_sh] * 1 < 3 && row[z_score] * 1 > -3"
    expected = "row[0] * 1 < 3 && row[1] * 1 > -3"
    assert convert_js_row_col_to_index(test_string, col_indices) == expected


def test_convert_js_vars():
    test_string = "abc {def} ghi"
    expected = "abc '+def+' ghi"
    assert convert_js_vars(test_string) == expected


class DfTestModel(db.Model):
    """
    Just a model for testing, cannot start with 'test'
    """

    __tablename__ = "df_model"
    index = db.Column(db.Integer(), primary_key=True)
    gene = db.Column(db.String(), nullable=False)
    z_score = db.Column(db.Float(), nullable=True)
    r_squared = db.Column(db.Numeric(), nullable=True)
    other = db.Column(db.String(), nullable=False)


def test_data_table_from_data(app):
    """
    Test that data table can be initiated from a DataTableData object, and the cols are correctly subset
    """
    cols = ["r_squared", "gene", "z_score"]
    display = TableDisplay(
        cols, {"type": "test_table"}, replace_underscores=False, make_title_case=False
    )
    get_column_types = lambda: {
        col.name: col.type for col in DfTestModel.query.statement.columns
    }
    data = DataTableData(get_column_types, lambda: df)
    table = DataTable(data, display, "test_data_table", "filename")
    assert len(table._df.columns) == 3
    assert df[cols].equals(table._df)


def test_order_rename_format(app):
    """
    Test that:
    Only selected columns are selected, and are in the correct order.
    Renames are renamed correctly, and do not have replace_underscores or make_title_case applied to them
    Formatting is correctly applied to the specified column, and not others
    Testing the actual values is crucial to ensuring that the values correctly follow the column order
    """
    df.to_sql("df_model", db.engine, if_exists="replace")
    cols = ["r_squared", "gene", "z_score"]
    display = TableDisplay(
        cols,
        {"type": "test_table"},
        renames={"r_squared": "lowercase_with_underscores"},
        format={"z_score": "{0:.10f}"},
    )
    table = DataTable(DfTestModel.query, display, "test_data_table", "filename")
    data_for_ajax_partial = table.data_for_ajax_partial()

    # Test that:
    # 1. only the selected cols are used
    # 2. order is correct
    # 3. Renames are applied to the df
    display_cols = ["lowercase_with_underscores", "Gene", "Z Score"]
    assert data_for_ajax_partial["cols"] == display_cols

    # Test numeric inference is correct despite formatting
    assert set(data_for_ajax_partial["display"]["numeric_col_indices"]) == {
        cols.index("z_score"),
        cols.index("r_squared"),
    }

    # Test that:
    # Despite changing order of columns and renaming, lowercase_with_underscores still has the correct values
    # {0:.10f} was applied to z_score but not to r_squared
    json_data = json_loads(table.json_data())
    index_of_lowercase_with_underscores = display_cols.index(
        "lowercase_with_underscores"
    )
    index_of_z_score = display_cols.index("Z Score")
    for row in json_data["data"]:
        # fyi this remains numeric (not string) because not formatted
        assert row[index_of_lowercase_with_underscores] == r_squared_value
        assert len(row[index_of_z_score].split(".")[1]) == 10  # test that 10 decimals


@pytest.mark.parametrize(
    "sort_col, expected_sort_col, expected_sort_order",
    [
        ("gene", "gene", None),
        ("r_squared", "r_squared", None),
        (("gene", "desc"), "gene", "desc"),
        (("r_squared", "asc"), "r_squared", "asc"),
    ],
)
def test_data_table_sort_col(app, sort_col, expected_sort_col, expected_sort_order):
    """
    Test correct parsing of sort_col param, depending on whether it is a string or tuple
    """
    df.to_sql("df_model", db.engine, if_exists="replace")
    cols = ["r_squared", "gene", "z_score"]
    display = TableDisplay(cols, {"type": "test_table"}, sort_col=sort_col)
    table = DataTable(DfTestModel.query, display, "test_data_table", "filename")
    data_for_ajax_partial = table.data_for_ajax_partial()
    assert data_for_ajax_partial["display"]["sort_col"] == cols.index(expected_sort_col)
    assert data_for_ajax_partial["display"]["sort_order"] == expected_sort_order


def test_data_table_df_cache(app):
    """
    Test that
    The data_table initally has no property 'df'
    Calling _df puts the df property on the data_table
    """
    df.to_sql("df_model", db.engine, if_exists="replace")

    cols = list(df.columns)
    display = TableDisplay(
        cols, {"type": "test_table"}, replace_underscores=False, make_title_case=False
    )
    table = DataTable(DfTestModel.query, display, "test_data_table", "filename")
    assert not hasattr(table, "df")
    table_df = table._df
    assert hasattr(table, "df")
    assert df.equals(table_df)


def test_ajax_table_data_for_partial(app):
    """
    Test for expected keys and that the df is not evaluated
    The correctness of no hasattr 'df' meaning that _df is not called is somewhat tested in test_data_table_df_cache
    """
    df.to_sql("df_model", db.engine, if_exists="replace")
    display = TableDisplay(
        list(df.columns),
        {"type": "test_table"},
        replace_underscores=False,
        make_title_case=False,
    )
    table = DataTable(
        DfTestModel.query, display, "test_data_table", "filename"
    ).data_for_ajax_partial()

    assert not hasattr(table, "df")  # df should not have been evaluated

    expected_keys = ["ajax_url", "cols", "name", "display"]
    assert all([key in table for key in expected_keys])
    assert "rows" not in table
    assert table["ajax_url"] == "/partials/data_table/test_table"
    assert table["download_url"] == "/partials/data_table/download/test_table"

    expected_display_keys = ["numeric_col_indices", "renders"]
    assert all([key in table["display"] for key in expected_display_keys])


def test_ajax_json_data(app):
    """
    Test that structure is as expected
    """
    df.to_sql("df_model", db.engine, if_exists="replace")
    display = TableDisplay(["gene", "z_score"], {"type": "test_table"})
    json_table = DataTable(
        DfTestModel.query, display, "test_data_table", "filename"
    ).json_data()
    table = json_loads(json_table)

    assert "data" in table
    assert table["data"] == [["one gene", -0.2], ["another gene", 0.6]]


def test_table_display_render_data_for_partial():
    """
    Test structure and target col output indices are correct
    """
    col_indices = {"one": 1, "two": 2, "three": 3}
    table_display_render = TableDisplayRender(
        lambda col_indices: "some render", ["one", "three"]
    ).data_for_partial(col_indices)
    assert table_display_render["render"] == "some render"
    assert set(table_display_render["target_cols"]) == {1, 3}


def test_table_display_link_data_for_partial():
    """
    Test that the a href string concatenation turns out correct.
    Could go further and evaluate the javascript, but seems unnecessary once we figure that this hardcoded thing is fine
    """
    col_indices = {"one": 1, "two": 2, "three": 3}
    table_display_render = TableDisplayLink("'/some/url/'", "one").data_for_partial(
        col_indices
    )
    assert (
        table_display_render["render"] == "'<a href=\"'+'/some/url/'+'\">'+data+'</a>'"
    )
    assert "condition" not in table_display_render


def test_table_display_entity_link_data_for_partial(app):
    col_indices = {"type": 1, "gene/compound": 2, "url_label": 3}
    entity_link = TableDisplayEntityLink("gene/compound")
    render = entity_link.data_for_partial(col_indices)
    assert (
        render["render"]
        == """'<a href="'+urlRoots[row['Type']]+row['Url Label']+'">'+data+'</a>'"""
    )


def test_table_display_button_data_for_partial():
    col_indices = {"one": 1, "two": 2, "three": 3}
    table_display_button = TableDisplayButton(
        "console.log('hi');", "one", html_data={"two_value": "{row[two]}"}
    )
    table_display_render = table_display_button.data_for_partial(col_indices)
    assert (
        table_display_render["render"]
        == """'<button type="button" class="btn btn-default btn-xs" two_value="'+row[2]+'">'+data+'</button>'"""
    )


def test_table_display_button_event_handler(app):
    """
    Test that the event handler for button clicking correctly appears in additional_js
    :return: 
    """
    cols = ["r_squared", "gene", "z_score"]
    renders = [TableDisplayButton("console.log('hi');", "r_squared")]
    df.to_sql("df_model", db.engine, if_exists="replace")
    display = TableDisplay(cols, {"type": "test_table"}, renders=renders)

    table = DataTable(
        DfTestModel.query, display, "test_name", "filename"
    ).data_for_ajax_partial()
    expected_event_handler = "$('#data_table_test_name').on('click', 'button', function () {console.log('hi');})"

    assert len(table["display"]["additional_js"]) == 1
    assert table["display"]["additional_js"][0] == expected_event_handler


def test_table_display_renders(app):
    """
    Test that renders appears in TableDisplay, and that the renders have the same values as calling data_for_partial
    """
    cols = ["r_squared", "gene", "z_score"]
    col_indices = {col: index for index, col in enumerate(cols)}

    renders = [
        TableDisplayLink("'/some/url/'", "gene"),
        TableDisplayEntityLink("r_squared", "other"),
    ]

    df.to_sql("df_model", db.engine, if_exists="replace")
    display = TableDisplay(cols, {"type": "test_table"}, renders=renders)
    table = DataTable(
        DfTestModel.query, display, "test_data_table", "filename"
    ).data_for_ajax_partial()

    assert "renders" in table["display"]
    assert all(
        [
            render.data_for_partial(col_indices) in table["display"]["renders"]
            for render in renders
        ]
    )


@pytest.mark.parametrize(
    "link_col, link_css_cols", [("gene", ["gene"]), ("z_score", ["gene", "gene"])]
)
def test_table_clashing_render_columns(app, link_col, link_css_cols):
    """
    Test that trying to apply multiple on the same column raises an error   
    """
    renders = [
        TableDisplayLink("'/some/url/'", link_col),
        TableDisplayEntityLink(link_col, "other"),
    ]

    df.to_sql("df_model", db.engine, if_exists="replace")
    display = TableDisplay(["r_squared", "gene", "z_score"], "/", renders=renders)
    with pytest.raises(AssertionError):
        DataTable(
            DfTestModel.query, display, "test_data_table", "filename"
        ).data_for_ajax_partial()
