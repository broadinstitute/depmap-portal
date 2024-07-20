from sqlalchemy import create_engine
from flask import Flask
import json
from typing import List
from depmap.extensions import (
    cache_without_user_permissions,
    memoize_without_user_permissions,
)
import pytest

from depmap.access_control.sql_rewrite import (
    enable_access_controls,
    is_setup_correctly_with_views,
    create_filtered_views,
)
from depmap.access_control import (
    get_authenticated_user,
    all_records_visible,
    get_visible_owner_id_configs,
    assume_user,
    all_records_visible,
    get_current_user_for_access_control,
    load_auth_config_for_app,
    PUBLIC_ACCESS_GROUP,
)
from depmap.access_control.models import GroupAuthConfig
from tests.utilities.access_control import request_as_user

# write out config with a single user
AUTH_CONFIG_OBJ: List[GroupAuthConfig] = [
    GroupAuthConfig("Private 1", "private1", users=["joe@sample.com"], owner_id=1),
    GroupAuthConfig("Private 2", "private2", users=["sarah@sample.com"], owner_id=2),
    GroupAuthConfig("Admin", "admin users", True, users=["admin@sample.com"]),
    GroupAuthConfig(
        "Email domain",
        "test email domain",
        email_domains=["private.sample.com"],
        owner_id=3,
    ),
]


def test_controlled_views(tmpdir):
    """
    Test
        normal requests
        session override of user
    """
    # set up database with a few records
    db = str(tmpdir.join("db"))
    engine = create_engine("sqlite:///" + db)
    engine.execute("CREATE TABLE FILTERED (value VARCHAR , owner_id number)")
    for rec in [
        ("public", PUBLIC_ACCESS_GROUP),
        ("private1", 1),
        ("private2", 2),
        ("email_domain", 3),
    ]:
        engine.execute("INSERT INTO FILTERED (value, owner_id) values (?, ?)", rec)
    table_mapping = {"filtered": "filtered_write_only"}

    # now setup app
    app = Flask("test_views")
    app.config.from_mapping(
        dict(
            AUTH_CONFIG_OBJ=AUTH_CONFIG_OBJ,
            DEFAULT_USER_ID="nobody",
            SECRET_KEY="bananas",
        )
    )

    # verify views are not in place
    with engine.begin() as c:
        assert not is_setup_correctly_with_views(c, table_mapping)

    # set up the app
    create_filtered_views(engine, table_mapping)
    enable_access_controls(engine, table_mapping)
    # verify views are in place now
    with engine.begin() as c:
        assert is_setup_correctly_with_views(c, table_mapping)

    load_auth_config_for_app(app)

    def get_values():
        return set(
            [x[0] for x in engine.execute("SELECT value FROM FILTERED").fetchall()]
        )

    with app.test_request_context("/"):
        # make sure the views got installed correctly
        with engine.begin() as c:
            assert is_setup_correctly_with_views(c, table_mapping)

        # Our user is set to the default which means we can only see the private date
        assert get_values() == set(["public"])

    with request_as_user(app, "joe@sample.com"):
        assert get_values() == set(["public", "private1"])

    with request_as_user(app, "sarah@sample.com"):
        assert get_values() == set(["public", "private2"])

    # test email domain
    with request_as_user(app, "anyone@private.sample.com"):
        assert get_values() == set(["public", "email_domain"])

    # test email domain will only match the exact domain
    with request_as_user(app, "private.sample.com@infiltrator.com"):
        assert get_values() == set(["public"])
    with request_as_user(app, "infiltrator@private.sample.com.infiltrator"):
        assert get_values() == set(["public"])

    # by default admin can only see public data
    with request_as_user(app, "admin@sample.com"):
        assert get_values() == set(["public"])

    # but admins can impersonate other users
    with request_as_user(app, "admin@sample.com", session_email="sarah@sample.com"):
        assert get_values() == set(["public", "private2"])


def test_role_changes(tmpdir):
    """
    Test
        assume_user
        all_records_visible
    """
    # set up database with a few records
    db = str(tmpdir.join("db"))
    engine = create_engine("sqlite:///" + db)
    engine.execute("CREATE TABLE FILTERED (value VARCHAR , owner_id number)")
    for rec in [
        ("public", PUBLIC_ACCESS_GROUP),
        ("private1", 1),
        ("private2", 2),
        ("email_domain", 3),
    ]:
        engine.execute("INSERT INTO FILTERED (value, owner_id) values (?, ?)", rec)
    table_mapping = {"filtered": "filtered_write_only"}

    # now setup app
    app = Flask("test_views")
    app.config.from_mapping(
        dict(
            AUTH_CONFIG_OBJ=AUTH_CONFIG_OBJ,
            DEFAULT_USER_ID="anonymous",
            SECRET_KEY="bananas",
        )
    )

    # verify views are not in place
    with engine.begin() as c:
        assert not is_setup_correctly_with_views(c, table_mapping)

    # set up the app
    create_filtered_views(engine, table_mapping)
    enable_access_controls(engine, table_mapping)

    load_auth_config_for_app(app)

    def get_values():
        return set(
            [x[0] for x in engine.execute("SELECT value FROM FILTERED").fetchall()]
        )

    with app.test_request_context("/"):
        # Our user is set to the default which means we can not see the private date
        assert get_current_user_for_access_control() == "anonymous"
        assert get_values() == set(["public"])

        assert get_current_user_for_access_control() == "anonymous"
        with assume_user("joe@sample.com"):
            # assume user does not change the value of get_authenticated_user()
            assert get_authenticated_user() == "anonymous"
            # but it does change the value of get_current_user_for_access_control()
            assert get_current_user_for_access_control() == "joe@sample.com"
            assert get_values() == set(["public", "private1"])

            # verify we can nest assume_user
            with assume_user("sarah@sample.com"):
                assert get_current_user_for_access_control() == "sarah@sample.com"
                assert get_values() == set(["public", "private2"])

            # verify after we exit the with block we are the previous user
            assert get_current_user_for_access_control() == "joe@sample.com"
            assert get_values() == set(["public", "private1"])

        with all_records_visible(allow_unsafe_promotion=True):
            assert len(get_visible_owner_id_configs()) == 4
            assert get_values() == set(
                ["public", "private1", "private2", "email_domain"]
            )

        # and we're anonymous again
        assert get_current_user_for_access_control() == "anonymous"
        assert get_values() == set(["public"])


def test_caching_access_controlled_data_prevented(app):
    from depmap.access_control import get_current_user_for_access_control, assume_user

    @cache_without_user_permissions()
    def cached_call():
        return get_current_user_for_access_control()

    @memoize_without_user_permissions()
    def memoized_call():
        return get_current_user_for_access_control()

    @memoize_without_user_permissions()
    def calls_cached():
        return cached_call()

    with assume_user("joe"):
        # make sure the username is right before and after the cached call, but not within the call
        assert get_current_user_for_access_control() == "joe"
        assert cached_call() == "nobody-cached-call"
        assert get_current_user_for_access_control() == "joe"

        # same check for memoized
        assert memoized_call() == "nobody-cached-call"
        assert get_current_user_for_access_control() == "joe"

        # lastly, make sure nesting of cache calls works fine
        assert calls_cached() == "nobody-cached-call"
        assert get_current_user_for_access_control() == "joe"
