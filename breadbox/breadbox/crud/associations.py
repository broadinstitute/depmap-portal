from pyasn1.codec.ber.encoder import encode

from breadbox.models.dataset import PrecomputedAssociation, Dataset, MatrixDataset
from breadbox.db.session import SessionWithUser
from . import dataset as dataset_crud
from breadbox.schemas.custom_http_exception import (
    ResourceNotFoundError,
    UserError,
    HTTPException,
)
import os
from ..service import metadata
from ..crud import access_control
from typing import Optional
import packed_cor_tables


def _validate_association_table(
    dataset_1_given_ids: set[str], dataset_2_given_ids: set[str], filename: str
):
    """Opens file as a sqlite3 db and verifies the dimensions have the expected IDs. Raises an UserError if any issues found"""

    def check_given_ids(expected_given_ids: set[str], dim: str):
        assoc_dataset_given_ids = packed_cor_tables.get_given_ids(filename, dim)
        missing = expected_given_ids.difference(assoc_dataset_given_ids)
        if len(missing) > 0:
            assoc_sample = sorted(assoc_dataset_given_ids)[:10]
            expected_sample = sorted(expected_given_ids)[:10]
            missing_sample = sorted(missing)[:10]
            raise UserError(
                f"The given IDs in the association table do not match the IDs in the dataset. ({len(missing)} IDs missing). Examples from association table: {assoc_sample}, examples from dataset: {expected_sample}, examples of missing IDs: {missing_sample}"
            )

    try:
        check_given_ids(dataset_1_given_ids, "0")
        check_given_ids(dataset_2_given_ids, "1")
    except packed_cor_tables.InvalidAssociationTable as ex:
        raise UserError("Invalid association table") from ex


def add_association_table(
    db: SessionWithUser,
    dataset_1_id: str,
    dataset_2_id: str,
    axis: str,
    filestore_location: str,
    filename: str,
):
    def get_matrix_dataset(dataset_id):
        dataset = dataset_crud.get_dataset(db, db.user, dataset_id)
        if dataset is None:
            raise ResourceNotFoundError(f"Dataset {dataset_id} not found")
        if dataset.format != "matrix_dataset":
            raise UserError(f"Dataset {dataset_id} is not a matrix dataset")

        return dataset

    dataset_1 = get_matrix_dataset(dataset_1_id)
    dataset_2 = get_matrix_dataset(dataset_2_id)

    # require write access to at least one of the two dataset's group to add associations
    if not (
        access_control.user_has_access_to_group(
            dataset_1.group, db.user, write_access=True
        )
        or access_control.user_has_access_to_group(
            dataset_2.group, db.user, write_access=True
        )
    ):
        raise HTTPException(403, "You do not have permission to update either dataset")

    if axis == "feature":
        dataset_1_given_ids = set(
            metadata.get_matrix_dataset_feature_labels_by_id(db, db.user, dataset_1)
        )
        dataset_2_given_ids = set(
            metadata.get_matrix_dataset_feature_labels_by_id(db, db.user, dataset_2)
        )
    else:
        assert axis == "sample"
        dataset_1_given_ids = set(
            metadata.get_matrix_dataset_sample_labels_by_id(db, db.user, dataset_1)
        )
        dataset_2_given_ids = set(
            metadata.get_matrix_dataset_sample_labels_by_id(db, db.user, dataset_2)
        )

    _validate_association_table(
        dataset_1_given_ids,
        dataset_2_given_ids,
        os.path.join(filestore_location, filename),
    )

    precomputed_assoc = PrecomputedAssociation(
        dataset_1_id=dataset_1_id,
        dataset_2_id=dataset_2_id,
        axis=axis,
        filename=filename,
    )
    db.add(precomputed_assoc)
    db.flush()
    return precomputed_assoc


def get_association_tables(db: SessionWithUser, dataset_id: Optional[str]):
    from sqlalchemy.orm import aliased

    d1 = aliased(MatrixDataset)
    query = db.query(PrecomputedAssociation).join(d1, PrecomputedAssociation.dataset_1)
    if dataset_id is not None:
        query = query.filter(d1.id == dataset_id)
    return query.all()


def delete_association_table(db: SessionWithUser, id: str, filestore_location: str):
    table = (
        db.query(PrecomputedAssociation)
        .filter(PrecomputedAssociation.id == id)
        .one_or_none()
    )
    if table is None:
        raise ResourceNotFoundError(f"Association table {id} not found")

    if not (
        access_control.user_has_access_to_group(
            table.dataset_1.group, db.user, write_access=True
        )
        or access_control.user_has_access_to_group(
            table.dataset_2.group, db.user, write_access=True
        )
    ):
        raise HTTPException(
            403, f"You do not have permission to delete the associations {table.id}"
        )

    db.delete(table)

    # clean up sqlite file
    full_path = os.path.join(filestore_location, table.filename)
    os.remove(full_path)
