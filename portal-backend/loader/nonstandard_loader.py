import os
import shutil

from flask import current_app

from depmap.database import db
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    RowNonstandardMatrix,
    NonstandardMatrixLoaderMetadata,
)
from depmap.interactive.nonstandard import nonstandard_utils
from depmap.utilities.models import log_data_issue
from depmap.gene.models import Gene
from depmap.entity.models import Entity
from depmap.access_control import PUBLIC_ACCESS_GROUP
from loader import gene_loader


def delete_cache_if_invalid_exists(dataset_id, config):
    """
    Takes in config instead of getting it from current_app for ease of testing
    """
    if dataset_index_exists(dataset_id) and not loaded_transpose_matches(
        dataset_id, config["transpose"]
    ):
        delete_nonstandard_matrix(dataset_id)
        db.session.commit()
        print(
            "Deleted nonstandard matrix {} because transpose changed".format(dataset_id)
        )


def add_nonstandard_matrix(taiga_id: str, source_file_path: str, owner_id: int):
    def get_entity_class_from_config(dataset_config):
        """
        The interactive_db_mock_downloads test fixture wants to use a fake InteractiveConfig, and cannot instantiate the real InteractiveConfig first.
        This is separated from get_entity_class in the interactive module because add_nonstandard_matrix is used in the interactive_db_mock_downloads test fixture
        Separation allows add_nonstandard_matrix to run and thus the interactive_db_mock_downloads test fixture to be instantiated without calling __get_config() and thus creating a config
        """
        if "entity" in dataset_config:
            assert issubclass(
                dataset_config["entity"], Entity
            ), "Invalid entity {} from {}".format(
                dataset_config["entity"], dataset_config
            )
            return dataset_config["entity"]
        else:
            return None

    base_name = os.path.basename(source_file_path)
    source_dir = current_app.config["NONSTANDARD_DATA_DIR"]
    abs_dest_path = os.path.join(source_dir, base_name)

    if os.path.abspath(source_file_path) != abs_dest_path:
        shutil.copy(source_file_path, abs_dest_path)

    NONSTANDARD_DATASETS = current_app.config["GET_NONSTANDARD_DATASETS"]()
    config = NONSTANDARD_DATASETS[taiga_id]
    entity_class = get_entity_class_from_config(config)

    NonstandardMatrix.read_file_and_add_dataset_index(
        taiga_id,
        config,
        base_name,
        entity_class,
        "use_arxspan_id" in config and config["use_arxspan_id"],
        owner_id,
        load_row_with_entity,
        register_transpose=True,
    )


def dataset_index_exists(dataset_id):
    """ 
    :return: Boolean whether an index for dataset_id already exists in the db
    """
    return db.session.query(
        NonstandardMatrix.query.filter_by(nonstandard_dataset_id=dataset_id).exists()
    ).scalar()


def load_row_with_entity(
    row_name,
    index,
    dataset_id,
    row_index_objects,
    entity_class,
    custom_entity_match,
    enforce_entity_all_rows,
):
    """
    :return: boolean whether row was added 
    """
    if entity_class == Gene:
        if custom_entity_match is not None:
            entity = gene_loader.get_gene_from_custom_entity_match(
                row_name, custom_entity_match, must=enforce_entity_all_rows
            )
        else:
            entity = gene_loader.get_gene(row_name, must=enforce_entity_all_rows)
    else:
        raise ValueError(
            "Specified entity_class {} does not have an implemented row name to entity look up (.get_entity_id_from_matrix_row_name in old dplot)".format(
                entity_class
            )
        )

    if entity is None:
        log_data_issue(
            "{} nonstandard".format(dataset_id),
            "Missing entity",
            identifier=row_name,
            id_type="symbol",
        )
        return False
    else:
        entity_id = entity.entity_id
        row_index_objects.append(RowNonstandardMatrix(index=index, entity_id=entity_id))
        return True


def loaded_transpose_matches(dataset_id, current_transpose):
    return (
        NonstandardMatrixLoaderMetadata.query.filter_by(
            nonstandard_dataset_id=dataset_id
        )
        .one()
        .transpose
        == current_transpose
    )


def delete_nonstandard_matrix(dataset_id):
    nonstandard_matrix = NonstandardMatrix.query.filter_by(
        nonstandard_dataset_id=dataset_id
    ).one()
    nonstandard_matrix.row_index.delete()
    nonstandard_matrix.col_index.delete()
    NonstandardMatrix.query.filter_by(
        nonstandard_dataset_id=dataset_id
    ).delete()  # delete has to be called on the query
    NonstandardMatrixLoaderMetadata.query.filter_by(
        nonstandard_dataset_id=dataset_id
    ).delete()
