import re
from typing import List, Optional
import click
import subprocess
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from breadbox.db.session import SessionWithUser
from breadbox.config import Settings, get_settings
from breadbox.crud.access_control import PUBLIC_GROUP_ID, TRANSIENT_GROUP_ID
from breadbox.crud import group as group_crud
from breadbox.crud import dimension_types as types_crud
from breadbox.crud import data_type as data_type_crud
from breadbox.db.util import transaction
from breadbox.models.group import AccessType
from breadbox.schemas.group import GroupIn, GroupEntryIn
from pydantic import ValidationError
from breadbox.service.dataset import add_dimension_type
import logging

import os
import shutil
from db_load import upload_example_datasets
import hashlib


@click.group()
def cli():
    pass


@cli.command()
@click.argument("user_email")
@click.argument("group_name")
def add_user_to_group(user_email: str, group_name: str):
    """Add a username as an owner of the given group. Used to bootstrap the permissions"""
    db = _get_db_connection()
    settings = get_settings()
    group = group_crud.get_group_by_name(
        db, settings.admin_users[0], group_name, write_access=True
    )
    assert group is not None, f"Could not find group named {group_name}"

    group_entry = group_crud.GroupEntry(
        group=group, access_type=AccessType.owner, email=user_email, exact_match=True,
    )
    db.add(group_entry)
    db.commit()


@cli.command()
def shell():
    "Start a shell with settings and db loaded"
    from bpython import embed

    settings = get_settings()
    db = _get_db_connection()
    embed(
        {"settings": settings, "db": db},
        banner="bpython shell initialized. Predefined variables: db, settings",
    )


@cli.command()
def upgrade_db():
    logging.basicConfig(level=logging.INFO)

    # Create and/or upgrade the database
    _upgrade_db()

    db = _get_db_connection()
    settings = get_settings()

    with db.begin():
        # Ensure that the minimal data exists
        _populate_minimal_data(db, settings)


def _get_db_connection():
    settings = get_settings()
    engine = create_engine(
        settings.sqlalchemy_database_url, connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine, class_=SessionWithUser
    )
    db: SessionWithUser = SessionLocal()
    db.set_user(settings.admin_users[0])
    return db


def _regenerate_entire_search_index(db: SessionWithUser):
    from breadbox.crud.dimension_types import get_dimension_types, get_dimension_type
    from breadbox.service.search import populate_search_index_after_update

    dimension_type_names = [x.name for x in get_dimension_types(db)]
    # re-look up each dimension_type by name to make sure the instance of dimension_type we have is associated with
    # the session after we clear it each loop. If we were looping over instances of dimension_types, the call to expunge_all
    # could cause problems, because the next instance would be in a "detached" state.
    with transaction(db):
        for dimension_type_name in dimension_type_names:
            dimension_type = get_dimension_type(db, dimension_type_name)
            assert dimension_type is not None
            populate_search_index_after_update(db, dimension_type)
            # I'm concerned about sqlalchemy collecting too many objects in memory, so write everything to the DB
            # and then clear the db session for each call to populate_search_index_after_update
            db.flush()
            db.expunge_all()


def _post_alembic_upgrade(db: SessionWithUser):
    """This method is called after we apply alembic schema migrations. Alembic migrations are great for cases which are
    simple enough that they can be achieved with SQL or a small amount of Python. However, we can't use any
    crud/service methods until the schema is fully updated. If there's anything you want to run _after_ the schema is
    fully up to date, you can put it here. (And if it's not something very quick, you may want to add something to
    record that that step was run so that it doesn't happen every time the DB is upgraded)"""

    # if we've done anything to the schema for the search index, it's easiest to just delete all the
    # contents and regenerate it. So, check to see if the search index is empty, and if so, that's a sign we've
    # truncated it, and we should regenerate the whole thing.
    from breadbox.models.dataset import DimensionSearchIndex

    if db.query(DimensionSearchIndex).count() == 0:
        print(
            "No entries in DimensionSearchIndex -- proceeding to regenerate the search index"
        )
        _regenerate_entire_search_index(db)
        print("The search index is regenerated")


def _upgrade_db():
    # This has the side effect of create a SQLite database if one doesn't already exist
    subprocess.run(["alembic", "upgrade", "heads"], check=True)
    _post_alembic_upgrade(_get_db_connection())


@cli.command()
@click.argument("export_path")
def export_api_spec(export_path: str):
    """Write the openapi spec to the given path"""
    _export_api_spec(export_path)


def _get_openapi_spec():
    import tempfile
    from breadbox.startup import create_app

    with tempfile.TemporaryDirectory() as tmpdir:
        # tmpdir = tmpdir_obj.name
        settings = Settings(
            sqlalchemy_database_url=f"file://{tmpdir}/db",
            filestore_location=f"{tmpdir}/filestore",
            compute_results_location=f"{tmpdir}/results",
            admin_users=[],
            use_depmap_proxy=False,
            breadbox_secret="this value does not matter in this context",
            default_user=None,
        )

        app = create_app(settings)

        openapi = app.openapi()
    return openapi


def _export_api_spec(export_path: str):
    openapi = _get_openapi_spec()
    with open(export_path, "wt") as fd:
        json.dump(openapi, fd, indent=2, sort_keys=True)


@cli.command()
@click.argument("path")
def check_api(path: str):
    """Verify the openapi spec to the given path matches the current spec"""

    def mask_version(spec):
        # mask out the version number so the comparison is insensitve
        # to the version changing. There are a few ways the version number
        # in the spec might be wrong (ie: poetry install was not re-run, the version
        # number was bumped, but there actually was no spec change, etc) so
        # make the comparison insensitve to version number.
        spec["info"]["version"] = "MASKED"

    openapi = _get_openapi_spec()
    with open(path, "rt") as fd:
        existing = json.load(fd)

    mask_version(openapi)
    mask_version(existing)

    openapi_md5 = hashlib.md5(
        json.dumps(openapi, sort_keys=True).encode("utf8")
    ).hexdigest()
    existing_md5 = hashlib.md5(
        json.dumps(existing, sort_keys=True).encode("utf8")
    ).hexdigest()

    comparison_message = f"(Generated api spec MD5: {openapi_md5}, last generated client spec MD5: {existing_md5})"
    assert (
        existing == openapi
    ), f"""The openapi spec that was used to generate the
     breadbox client doesn't match what the latest code generates. The breadbox 
     client likely needs to be updated. You can do this by running: ./bb update-client
     
     {comparison_message}
     """
    print(comparison_message)


@cli.command()
@click.option("-p", "--with_proxy", is_flag=True, default=False)
def run(with_proxy):
    # before running, try reading settings to make sure they're valid
    # this function will throw an exception if there's a problem and
    # better to discover and abort now rather then when the
    # service is running and it's less likely to be noticed.
    try:
        get_settings()
    except ValidationError as ex:
        raise Exception(
            f"Could not load settings. You may need to update your .env file or environment variables: \n{ex}"
        )

    run_command_list = [
        "uvicorn",
        "breadbox.main:app",
        "--reload",
        "--reload-dir",
        "breadbox",
    ]
    if with_proxy:
        run_command_list = run_command_list + ["--root-path", "/breadbox"]

    subprocess.run(run_command_list, check=True)


@cli.command()
def bump_version():
    previous_version = _get_version()
    # NOTE: Bumping files only with cz still tries to check if previous version tag exists.
    # Don't raise error if no commits found to bump version (see https://commitizen-tools.github.io/commitizen/exit_codes/)
    subprocess.run(
        ["poetry", "run", "cz", "--no-raise", "21", "bump", "--check-consistency"],
        check=True,
    )
    new_version = _get_version()
    print(f"Successfully bumped version {previous_version} to {new_version}")


def _get_version():
    proc = subprocess.Popen(
        ["poetry", "run", "cz", "version", "-p"], stdout=subprocess.PIPE
    )
    assert proc.stdout
    version = proc.stdout.read().decode("utf-8").strip()
    return version


@cli.command()
def update_client():
    "Update the code for the breadbox client based. (Also saving out a new 'latest-breadbox-api.json' file)"

    _export_api_spec("../breadbox-client/latest-breadbox-api.json")  # TODO: call helper

    # use the breadbox-client-generator directory which has a different virtual env with incompatible
    # libraries, but we need it in order to run the openapi-python-client generator
    subprocess.run(
        ["poetry", "run", "./generate.sh",],
        check=True,
        cwd="../breadbox-client-generator",
    )


@cli.command("recreate-dev-db")
def recreate_dev_db():
    settings = get_settings()
    assert settings.sqlalchemy_database_url.startswith("sqlite:///")
    db_filename = settings.sqlalchemy_database_url[len("sqlite:///") :]

    # If the database already exists, delete it.
    if os.path.exists(db_filename):
        os.remove(db_filename)

    # create an empty database using alembic
    _upgrade_db()

    db = _get_db_connection()

    with db.begin():
        #  populate the minimal reference data
        _populate_minimal_data(db, settings)

        upload_example_datasets(db, settings)
    db.close()


def _populate_minimal_data(db: SessionWithUser, settings: Settings):
    """Populate the database with essential data if it does not already have it."""
    admin_user = settings.admin_users[0]

    # Define essential groups
    existing_public_group = group_crud.get_group(
        db, admin_user, PUBLIC_GROUP_ID, write_access=True
    )
    if not existing_public_group:
        public_group = group_crud.add_group(
            db, admin_user, GroupIn(name="Public"), PUBLIC_GROUP_ID,
        )
        group_crud.add_group_entry(
            db,
            admin_user,
            public_group,
            GroupEntryIn(email="", exact_match=False, access_type=AccessType.read),
        )

    existing_transient_group = group_crud.get_group(
        db, admin_user, TRANSIENT_GROUP_ID, write_access=True
    )
    if not existing_transient_group:
        transient_group = group_crud.add_group(
            db, admin_user, GroupIn(name="Transient"), TRANSIENT_GROUP_ID,
        )
        group_crud.add_group_entry(
            db,
            admin_user,
            transient_group,
            GroupEntryIn(email="", exact_match=False, access_type=AccessType.write),
        )

    # Define the generic type
    existing_generic_type = types_crud.get_dimension_type(db, name="generic")
    if not existing_generic_type:
        add_dimension_type(
            db,
            settings,
            user=admin_user,
            name="generic",
            display_name="Generic",
            id_column="label",
            axis="feature",
        )

    existing_user_upload_data_type = data_type_crud.get_data_type(db, "User upload")
    if not existing_user_upload_data_type:
        data_type_crud.add_data_type(db, "User upload")

    existing_metadata_data_type = data_type_crud.get_data_type(db, "metadata")
    if not existing_metadata_data_type:
        data_type_crud.add_data_type(db, "metadata")


@cli.command()
def dropdb():
    click.echo("Dropped the database")


def _run_worker(extra_args=[]):
    from celery.bin.celery import celery

    celery(
        ["-A", "breadbox.compute.worker.app", "worker", "-l", "info"] + list(extra_args)
    )


# ignore_unknown_options and nargs allows us to collect all remaining args and pass them on the cmd line
@cli.command("run_worker", context_settings={"ignore_unknown_options": True})
@click.option(
    "--name",
    default="unknown",
    # help="Has no effect but useful for putting the name of the environment in the command line to make it easier to identify which env this process belongs to",
)
@click.argument("celery_args", nargs=-1)
def run_worker(name, celery_args):
    """Starts a celery workers for running background jobs (and pass in any additional config via command line args)"""
    if len(celery_args) == 0:
        # the compute tasks cause a memory leak. we replace the worker process after every job to fix this
        celery_args = ["--max-tasks-per-child", "1"]
    print(f"Starting worker named {name} with args {celery_args}")
    _run_worker(celery_args)


@cli.command("run_dev_worker")
def run_dev_worker():
    """Starts a celery worker with some settings to make it easier to debug with. (concurrency of 1 and solo pool so there's less confusion from multiple workers and disable capturing stdout)"""

    def main_func():
        # celery_app.conf.worker_redirect_stdouts = False
        _run_worker(["--pool=solo", "-c", "1"])

    main_func()


if __name__ == "__main__":
    cli()
