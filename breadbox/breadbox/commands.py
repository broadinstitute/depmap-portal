import os

import click
import subprocess
import json
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from colorama import Fore, Style

from breadbox.crud.dataset import find_expired_datasets, delete_dataset
from breadbox.db.session import SessionWithUser
from breadbox.config import Settings, get_settings
from breadbox.crud.access_control import PUBLIC_GROUP_ID, TRANSIENT_GROUP_ID
from breadbox.crud import group as group_crud
from breadbox.crud import dimension_types as types_crud
from breadbox.crud import data_type as data_type_crud
from breadbox.crud import dataset as dataset_crud
from breadbox.crud.dimension_ids import get_matrix_dataset_given_ids, get_tabular_dataset_index_given_ids
from breadbox.db.util import transaction
from breadbox.models.dataset import DimensionTypeLabel, MatrixDataset
from breadbox.models.group import AccessType
from breadbox.schemas.group import GroupIn, GroupEntryIn
from pydantic import ValidationError
from breadbox.service.dataset import add_dimension_type
import logging
from datetime import timedelta

import os
from db_load import upload_example_datasets
from datetime import timedelta


@click.group()
def cli():
    pass


@cli.command()
@click.option("--dryrun", is_flag=True, default=False)
@click.option("--maxdays", default=60, type=int)
def delete_expired_datasets(maxdays, dryrun):
    db = _get_db_connection()
    settings = get_settings()
    expired_datasets = find_expired_datasets(db, timedelta(days=maxdays))

    print(f"Found {len(expired_datasets)} expired datasets")

    with transaction(db):
        for dataset in expired_datasets:
            dataset_summary = f"{dataset.id} (upload_date={dataset.upload_date}, expiry={dataset.expiry})"
            if dryrun:
                print(f"dryrun: Would have deleted {dataset_summary}")
            else:
                print(f"Deleting {dataset_summary}")
                delete_dataset(db, db.user, dataset, settings.filestore_location)
    print("Done")


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


def _regenerate_all_dim_type_labels(db: SessionWithUser):
    from breadbox.crud.dimension_types import get_dimension_types, get_dimension_type
    from breadbox.crud.dimension_ids import _populate_dimension_type_labels

    dimension_type_names = [x.name for x in get_dimension_types(db)]
    # re-look up each dimension_type by name to make sure the instance of dimension_type we have is associated with
    # the session after we clear it each loop. If we were looping over instances of dimension_types, the call to expunge_all
    # could cause problems, because the next instance would be in a "detached" state.
    with transaction(db):
        for dimension_type_name in dimension_type_names:
            print(dimension_type_name)
            _populate_dimension_type_labels(db, dimension_type_name)


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

    if db.query(DimensionTypeLabel).count() == 0:
        print("No entries in DimensionTypeLabel -- proceeding to regenerate")
        _regenerate_all_dim_type_labels(db)
        print("The dimension type labels are regenerated")


def _upgrade_db():
    # This has the side effect of create a SQLite database if one doesn't already exist
    subprocess.run(["alembic", "upgrade", "head"], check=True)
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
@click.option("-p", "--with_proxy", is_flag=True, default=False)
@click.option("--port", default=8000, help="The port to listen on")
@click.option("--host", default="127.0.0.1", help="Bind socket to this host")
@click.option(
    "--reload/--no-reload",
    default=True,
    help="Whether to monitor files and reload on changes",
)
# @click.option("--eager-tasks", default=False, is_flag=True, help="If set, sets up celery to execute tasks in 'eager' mode. (ie: without being dispatched to a worker)")
def run(with_proxy: bool, port: int, host: str, reload: bool):
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
        "--port",
        str(port),
        "--host",
        host,
    ]
    if with_proxy:
        run_command_list = run_command_list + ["--root-path", "/breadbox"]
    if reload:
        run_command_list = run_command_list + [
            "--reload",
            "--reload-dir",
            "breadbox",
        ]

    os.execvp(run_command_list[0], run_command_list)


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

    _export_api_spec("../breadbox-client/latest-breadbox-api.json")

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

@cli.command("log_data_issues")
def log_data_issues():
    """
    Identify places where dataset features are missing metadata and log them as data issues.
    Specifically, flag places where either:
    1. A matrix dataset has a large number of features or samples with no metadata (>5%).
    2. A matrix dataset has a large number of metadata records not referenced by any features in the dataset (not applicable to samples).
    """
    db = _get_db_connection()

    all_dimension_types = types_crud.get_dimension_types(db=db)

    for dimension_type in all_dimension_types:
        if dimension_type.dataset is None:
            print(f"Skipping dimension type {dimension_type.name} because it has no data")
            continue

        if dimension_type.axis == "feature":
            associated_datasets = dataset_crud.get_datasets(db=db, user=db.user, feature_type=dimension_type.name)
        else:
            associated_datasets = dataset_crud.get_datasets(db=db, user=db.user, sample_type=dimension_type.name)

        
        # Get all given IDs belonging to the metadata 
        metadata_given_ids = get_tabular_dataset_index_given_ids(db=db, dataset=dimension_type.dataset)

        # For now, only validate matrix datasets
        associated_datasets: list[MatrixDataset] = [d for d in associated_datasets if d.format == "matrix_dataset"]
        
        missing_metadata_issues = []
        unused_metadata_issues = []
        used_given_ids_across_datasets = set()
        for dataset in associated_datasets:
            dataset_given_ids = get_matrix_dataset_given_ids(db=db, dataset=dataset, axis=dimension_type.axis)
            used_given_ids_across_datasets.update(set(dataset_given_ids))

            missing_metadata_issue = _check_for_dataset_ids_without_metadata(dataset, dataset_given_ids, metadata_given_ids)
            if missing_metadata_issue:
                missing_metadata_issues.append(missing_metadata_issue)
            
            unused_metadata_issue = _check_for_metadata_not_in_dataset(dataset, dimension_type.axis, dataset_given_ids, metadata_given_ids)
            if unused_metadata_issue:
                unused_metadata_issues.append(unused_metadata_issue)

        # Summarize issues for this dimension type:
        issues = []

        if missing_metadata_issues:
            issues.append(f"Found {len(missing_metadata_issues)} datasets with records missing metadata:")
            for issue in missing_metadata_issues:
                issues.append("\t *" + issue)

        if unused_metadata_issues:
            issues.append(f"Found {len(unused_metadata_issues)} datasets which reference only a subuset of feature metadata:")
            for issue in unused_metadata_issues:
                issues.append("\t *" + issue)

        # Validate overall usage of metadata across all datasets
        if len(associated_datasets) > 0:
            unused_metadata_given_ids = set(metadata_given_ids).difference(used_given_ids_across_datasets)
            percent_unused_metadata_given_ids = len(unused_metadata_given_ids) / len(metadata_given_ids)
            if unused_metadata_given_ids:
                issues.append(f"Metadata contains {len(unused_metadata_given_ids)} unused records ({percent_unused_metadata_given_ids:.2%}%), including: {list(unused_metadata_given_ids)[:5]}")

        text_color = Fore.RED if issues else Fore.GREEN
        print(text_color + f"Dimension type {dimension_type.name} (referenced by {len(associated_datasets)} datasets) has {len(issues)} issues.")
        for issue in issues:
            print("\t" + issue)

        print(Style.RESET_ALL)

# TODO: move all hard-coded cutoffs to config file or database

def _check_for_dataset_ids_without_metadata(dataset: MatrixDataset, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[str]:
    """
    Return a warning string if there are a substantial number of features in dataset_given_ids that are not in metadata_given_ids.
    """
    dataset_ids_not_in_metadata = set(dataset_given_ids).difference(set(metadata_given_ids))
    percent_ids_not_in_metadata = len(dataset_ids_not_in_metadata) / len(dataset_given_ids)

    # Append a warning when a given matrix dataset has a large number of features or samples with no metadata.
    if percent_ids_not_in_metadata > 0.01:
        return f"'{dataset.name}': {len(dataset_ids_not_in_metadata)} given IDs ({percent_ids_not_in_metadata:.2%}) with no metadata including: {list(dataset_ids_not_in_metadata)[:5]}."


def _check_for_metadata_not_in_dataset(dataset: MatrixDataset, axis: str, dataset_given_ids: set[str], metadata_given_ids: set[str]) -> Optional[str]:
    # Get the cutoffs configured for this particular dataset
    dataset_configs = dataset.dataset_metadata
    min_percent_feature_metadata_used = dataset_configs.get("min_percent_feature_metadata_used", 95)

    metadata_ids_not_in_dataset = set(metadata_given_ids).difference(set(dataset_given_ids))
    percent_metadata_ids_not_in_dataset = len(metadata_ids_not_in_dataset) / len(metadata_given_ids)
    if percent_metadata_ids_not_in_dataset > (1 - min_percent_feature_metadata_used / 100) and axis == "feature":
        return f"'{dataset.name}': {percent_metadata_ids_not_in_dataset:.2%}% of metadata not referenced in this dataset."
    