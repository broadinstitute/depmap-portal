import click
from flask.cli import with_appcontext

from depmap import extensions
from depmap.access_control import all_records_visible
from depmap.dataset.models import DependencyDataset, Dataset, BiomarkerDataset
import logging
import typing

log = logging.getLogger(__name__)


@click.command("copy_breadbox_names")
@click.option("--dryrun", is_flag=True)
@with_appcontext
def copy_breadbox_names_cmd(dryrun: bool):
    # just a wrapper around the other function so we can call copy_breadbox_names via pytest without click getting in the way
    copy_breadbox_names(dryrun=dryrun)


def copy_breadbox_names(dryrun: bool):
    with all_records_visible():
        bb_datasets = extensions.breadbox.client.get_datasets()
        name_by_given_id = {
            x.given_id: x.name for x in bb_datasets if x.given_id is not None
        }
        for dataset in Dataset.get_all():
            assert isinstance(dataset, DependencyDataset) or isinstance(
                dataset, BiomarkerDataset
            )
            dataset_given_id = dataset.name.value
            bb_name = name_by_given_id.get(dataset_given_id)
            if bb_name is None:
                log.warning(
                    f"Skipping: {dataset.display_name} ({dataset_given_id}) is not in Breadbox"
                )
            else:
                log.warning(f"Updating: {dataset.display_name} -> {bb_name}")
                # pyright is confused about the type on this field
                dataset.display_name = bb_name  # pyright: ignore
        if dryrun:
            log.warning("Dryrun so skipping commit")
        else:
            extensions.db.session.commit()
            log.warning("Changes committed")
