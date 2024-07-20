from depmap.access_control import sql_rewrite
from depmap.access_control.sql_rewrite import create_rewritter
from sqlalchemy import create_engine


def test_rewrite_insert():
    rewrite = create_rewritter({"a": "b"})

    # certainly not exhaustive. Just cover some basic tests and add any broken cases here that we hit
    # during development
    names_to_test = [
        "a",
        "A",  # make sure case isn't a problem
        '"A"',  # make sure we can handle quoted table names
    ]
    for name in names_to_test:
        assert (
            rewrite("insert into {} values (1)".format(name))
            == "insert into b values (1)"
        ), "Error with {}".format(name)


def test_rewrite_delete():
    rewrite = create_rewritter({"a": "b"})

    # certainly not exhaustive. Just cover some basic tests and add any broken cases here that we hit
    # during development
    names_to_test = [
        "a",
        "A",  # make sure case isn't a problem
        '"A"',  # make sure we can handle quoted table names
    ]

    for name in names_to_test:
        assert (
            rewrite("DELETE FROM {} WHERE {}.cell_line_name = 1".format(name, name))
            == "DELETE FROM b WHERE b.cell_line_name = 1"
        ), "Error with {}".format(name)


def test_enable_access_controls():
    engine = create_engine("sqlite://")

    with engine.begin() as c:
        c.execute("create table T1 (A number)")
        c.execute("insert into T1 VALUES (1)")
        c.execute("create table T2 (A number)")
        c.execute("insert into T2 VALUES (2)")

    # turn T1 into a view, and leave T2 alone
    table_mapping = {"t1": "t1_write_only"}
    sql_rewrite.create_filtered_views(engine, table_mapping, "1=1")

    disable_fn = sql_rewrite.enable_access_controls(engine, table_mapping)

    with engine.begin() as c:
        # verify no exception reading a random table
        assert len(c.execute("select A from T2").fetchall()) == 1

        # verify no exception reading from table which should now be a view
        assert len(c.execute("select A from T1").fetchall()) == 1

        # verify no error writing to normal table
        c.execute("insert into T2 VALUES (3)")

        # verify no error writing to fake table
        c.execute("insert into T1 VALUES (4)")

        # verify we can read the values inserted
        assert c.execute("select A from T2 order by A").fetchall() == [(2,), (3,)]

        # verify we can read values inserted into fake table
        assert c.execute("select A from T1 order by a").fetchall() == [(1,), (4,)]

        disable_fn(c)
