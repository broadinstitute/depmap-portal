import re
import json
from sqlalchemy import event
from depmap.access_control import PUBLIC_ACCESS_GROUP

# This file contains the logic for working with views which have a built in filter to call __owned_by_is_visible(owner_id) and filter out rows
# which the current user does not have access to see.

# The first portion is focused around rewriting SQL so that when we try to mutate a table, we actually mutate the underlying table
# instead. The remaining code is about creating the appropriate views in place.

# These rewrite rules are based on the sqlite4 grammar at https://github.com/antlr/grammars-v4/blob/master/sqlite/SQLite.g4
# We could use antlr to generate a python parser and rewrite the AST. While this would be the most robust
# solution, it would take a decent amount of effort to implement and get familiar with antlr's API.
#
# Fortunately, the tables we need to rewrite only reside in
# mutation DML statements, and in a relatively simple portion of SQL's syntax. In addition, we have
# the advantage, that if there's a mistake, and a mutating statement is not recognized and rewritten,
# it won't result in a silent failure. (ie: trying to mutate a view will result in a very visible
# exception) This means we don't need to worry too much about errors in the regexps. If we see any,
# exceptions about trying to update a view, we can look at those statements and we can improve the rewriter.

# In the following we ignore "with_clause" because I don't believe SQLAlchemy ever uses it.
# handling delete_stmt and delete_stmt_limited rules:

delete_stmt_regexp = re.compile(
    "(\\s*DELETE\\s+FROM\\s+)([^ \\n\\t]+)(.*)", re.IGNORECASE | re.DOTALL
)
insert_stmt_regexp = re.compile(
    "(\\s*(?:INSERT|REPLACE|(?:INSERT\\s+OR\\s+REPLACE|ROLLBACK|ABORT|FAIL|IGNORE))\\s+INTO\\s+)([^ \\n\\t(]+)(.*)",
    re.IGNORECASE | re.DOTALL,
)
update_stmt_regexp = re.compile(
    "(\\s*UPDATE\\s+(?:(?:OR\\s+ROLLBACK\\s+)|(?:OR\\s+ABORT\\s+)|(?:OR\\s+REPLACE\\s+)|(?:OR\\s+FAIL\\s+)|(?:OR\\s+IGNORE\\s+))?)([^ \\n\\t]+)(.*)",
    re.IGNORECASE | re.DOTALL,
)


def create_rewritter(table_mapping):
    table_mapping = {k.lower(): v for k, v in table_mapping.items()}

    def rewrite_statement(statement):
        def map_table(table_name):
            if table_name.startswith('"'):
                table_name = json.loads(table_name)
            table_name = table_name.lower()

            replacement = table_mapping.get(table_name, table_name)
            # print("map_table {} -> {}".format(table_name, replacement))
            return replacement

        m = delete_stmt_regexp.match(statement)
        if m is not None:
            prefix = m.group(1)
            old_table_name = m.group(2)
            new_table_name = map_table(old_table_name)  # this maps the table
            rest = m.group(3).replace(
                old_table_name + ".", new_table_name + "."
            )  # map the columns on the table
            return prefix + new_table_name + rest

        m = insert_stmt_regexp.match(statement)
        if m is not None:
            prefix = m.group(1)
            table_name = map_table(m.group(2))
            rest = m.group(3)
            return prefix + table_name + rest

        m = update_stmt_regexp.match(statement)
        if m is not None:
            prefix = m.group(1)
            original_table_name = m.group(2)
            table_name = map_table(original_table_name)
            rest = m.group(3)
            # attempt to replace references to the table in the set statement
            assignment_expr = original_table_name + "(?=\\s*\\.\\s*[A-Za-z0-9_]+\\s*=)"
            rest = re.sub(assignment_expr, table_name, rest)
            return prefix + table_name + rest

        return statement

    return rewrite_statement


def _get_object_names_by_type(connection, type):
    rows = connection.execute(
        "select name from sqlite_master where type = ?", (type,)
    ).fetchall()
    return [x[0].lower() for x in rows]


def create_filtered_views(
    connection,
    table_mapping,
    where_clause="owner_id = {} OR owned_by_is_visible(owner_id) = 1".format(
        PUBLIC_ACCESS_GROUP
    ),
):
    if is_setup_correctly_with_views(connection, table_mapping):
        return

    # verify that we have all tables with the expected names
    tables = set(_get_object_names_by_type(connection, "table"))
    missing_tables = set(table_mapping.keys()) - tables
    assert len(missing_tables) == 0, "Missing tables: {}".format(missing_tables)

    # and no views exist
    views = set(_get_object_names_by_type(connection, "view"))
    assert len(views) == 0, "some views already exist: {}".format(views)

    for view_name, underlying_name in table_mapping.items():
        connection.execute(
            "ALTER TABLE {} RENAME TO {}".format(view_name, underlying_name)
        )
        connection.execute(
            "CREATE VIEW {} AS SELECT * FROM {} WHERE {}".format(
                view_name, underlying_name, where_clause
            )
        )


def assert_is_setup_correctly_with_views(connection, table_mapping):
    if is_setup_correctly_with_views(connection, table_mapping):
        return

    views = set(_get_object_names_by_type(connection, "view"))
    expected_views = set(table_mapping.keys())
    raise AssertionError(
        "expected to find views {} but found {}".format(expected_views, views)
    )


def is_setup_correctly_with_views(connection, table_mapping):
    # if the database is empty, return true (Occurs inside tests that don't actualy init the DB. Not sure if this is the best approach)
    tables = _get_object_names_by_type(connection, "table")
    if len(tables) == 0:
        return True

    views = set(_get_object_names_by_type(connection, "view"))
    expected_views = set(table_mapping.keys())
    return expected_views == views


def replace_filtered_views(connection, table_mapping):
    for view_name, underlying_name in table_mapping.items():
        connection.execute("DROP VIEW {}".format(view_name))
        connection.execute(
            "ALTER TABLE {} RENAME TO {}".format(underlying_name, view_name)
        )


def enable_access_controls(engine, table_mapping):
    assert_is_setup_correctly_with_views(engine, table_mapping)

    rewrite = create_rewritter(table_mapping)

    def before_cursor_execute(
        conn, cursor, statement, parameters, context, executemany
    ):
        after = rewrite(statement)
        return after, parameters

    event.listen(engine, "before_cursor_execute", before_cursor_execute, retval=True)

    def disable(connection):
        event.remove(engine, "before_cursor_execute", before_cursor_execute)
        replace_filtered_views(connection, table_mapping)

    return disable
