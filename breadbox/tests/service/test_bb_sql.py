# from breadbox.service.sql import make_virtual_module, sanitize_names

import apsw.ext


def test_sanitize_names():
    # avoid duplicates
    assert sanitize_names(["a", "A"]) == {"a": "a", "A": "a_1"}

    # make sure we handle numbers/non-letters at the beginning
    assert sanitize_names(["0", "_"]) == {"0": "_0", "_": "_"}

    # make sure we handle basic cases
    assert sanitize_names(["Apple", "grape fruit"]) == {
        "Apple": "apple",
        "grape fruit": "grape_fruit",
    }


def test_virtual_table():
    """Tests SELECTs with and without WHERE clauses from the virtual table."""

    # This is the function that will generate our data
    def get_matrix_data(offset=None, sample_id=None, feature_id=None):
        """
        Generator function that yields matrix data.
        Can be filtered by sample_id and/or feature_id.
        """
        print(f"Called get_matrix_data({sample_id}, {feature_id})")
        if offset is None:
            offset_v = 0
        else:
            offset_v = float(offset)
        data = [
            ("sample1", "feature1", 1.1 + offset_v),
            ("sample1", "feature2", 1.2 + offset_v),
            ("sample2", "feature1", 2.1 + offset_v),
            ("sample2", "feature2", 2.2 + offset_v),
        ]
        for sample_id_, feature_id_, value in data:
            if sample_id and sample_id_ != sample_id:
                continue
            if feature_id and feature_id_ != feature_id:
                continue
            yield (sample_id_, feature_id_, value)

    connection = apsw.Connection(":memory:")
    make_virtual_module(
        connection,
        "get_matrix_data",
        get_matrix_data,
        ("sample_id", "feature_id", "value"),
        ("offset",),
    )

    connection.execute(
        "CREATE VIRTUAL TABLE v_get_matrix_data using get_matrix_data(100)"
    )

    print(apsw.ext.format_query_table(connection, "select * from v_get_matrix_data"))
    #
    # print(apsw.ext.format_query_table(connection, "select sample_id, feature_id, value from v_get_matrix_data"))

    print(
        apsw.ext.format_query_table(
            connection, "select * from get_matrix_data() where sample_id = 'sample1'"
        )
    )

    print(
        apsw.ext.format_query_table(
            connection, "select * from get_matrix_data() where feature_id = 'feature1'"
        )
    )

    print(
        apsw.ext.format_query_table(
            connection,
            "select * from get_matrix_data() where feature_id = 'feature1' and sample_id = 'sample1'",
        )
    )

    # cursor = connection.cursor()
    #
    # cursor.execute("CREATE VIRTUAL TABLE matrix USING matrix_data(sample_id TEXT, feature_id TEXT, value REAL)")
    #
    # # Test full table scan (no constraints)
    # results_all = list(cursor.execute("SELECT * FROM matrix"))
    # expected_all = [
    #     ("sample1", "feature1", 1.1),
    #     ("sample1", "feature2", 1.2),
    #     ("sample2", "feature1", 2.1),
    #     ("sample2", "feature2", 2.2),
    # ]
    # assert results_all == expected_all
    #
    # # Test filtering by sample_id
    # results_sample1 = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'sample1'"))
    # expected_sample1 = [
    #     ("sample1", "feature1", 1.1),
    #     ("sample1", "feature2", 1.2),
    # ]
    # assert results_sample1 == expected_sample1
    #
    # # Test filtering by sample_id and feature_id
    # results_filtered = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'sample2' AND feature_id = 'feature2'"))
    # expected_filtered = [
    #     ("sample2", "feature2", 2.2),
    # ]
    # assert results_filtered == expected_filtered
    #
    # # Test with no results
    # results_none = list(cursor.execute("SELECT * FROM matrix WHERE sample_id = 'nonexistent'"))
    # assert results_none == []


def test_sql_sanitizing():
    parsed = sqlglot.parse("select * from x; update b set x=1", dialect="sqlite")
    assert len(parsed) == 2
    breakpoint()
    print(parsed)
    parsed = sqlglot.parse("select * from x", dialect="sqlite")
    assert len(parsed) == 1
    breakpoint()
    assert isinstance(parsed[0], sqlglot.expressions.Select)
    print(parsed)
