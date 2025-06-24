import os.path
from typing import Annotated, List, Optional
import shutil

from fastapi import Body, Depends
from itsdangerous import URLSafeSerializer

from breadbox.api.dependencies import get_db_with_user
from breadbox.config import Settings, get_settings
from breadbox.db.session import SessionWithUser
from breadbox.api.uploads import construct_file_from_ids
from breadbox.schemas.associations import (
    Associations,
    AssociationTable,
    AssociationsIn,
    SliceQueryAssociations,
)
from typing import List
from breadbox.service import associations as associations_service
from breadbox.crud import associations as associations_crud
import uuid
from breadbox.db.util import transaction
from typing import cast, Literal

from .router import router


@router.post(
    "/associations/query-slice",
    operation_id="get_associations_for_slice",
    response_model=Associations,
    response_model_exclude_none=False,
)
def query_associations_for_slice(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    slice_query: Annotated[
        SliceQueryAssociations, Body(description="A Data Explorer 2 context expression")
    ],
):
    return associations_service.get_associations(
        db, settings.filestore_location, slice_query
    )


@router.get(
    "/associations",
    operation_id="get_associations",
    response_model=List[AssociationTable],
)
def get_associations(db: Annotated[SessionWithUser, Depends(get_db_with_user)]):
    return [
        AssociationTable(
            id=a.id,
            dataset_1_id=a.dataset_1_id,
            dataset_2_id=a.dataset_2_id,
            dataset_1_name=a.dataset_1.name,
            dataset_2_name=a.dataset_2.name,
            axis=a.axis,
        )
        for a in associations_crud.get_association_tables(db, None)
    ]


@router.delete("/associations/{id}")
def delete_associations(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    id: str,
):
    with transaction(db):
        return associations_crud.delete_association_table(
            db, id, settings.filestore_location
        )


@router.post(
    "/associations",
    operation_id="add_associations",
    response_model=AssociationTable,
    response_model_exclude_none=False,
)
def add_associations(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    associations_in: Annotated[
        AssociationsIn,
        Body(
            description="The associations table and which two datasets table references"
        ),
    ],
):

    serializer = URLSafeSerializer(settings.breadbox_secret)

    full_file = construct_file_from_ids(
        associations_in.file_ids,
        associations_in.md5,
        serializer,
        settings.compute_results_location,
    )

    dest_filename = f"associations/{uuid.uuid4()}.sqlite3"
    full_dest_filename = os.path.join(settings.filestore_location, dest_filename)
    # make sure the directory exists before trying to move the file to it's final name
    os.makedirs(os.path.dirname(full_dest_filename), exist_ok=True)

    shutil.move(full_file, full_dest_filename)

    try:
        with transaction(db):
            assoc_table = associations_crud.add_association_table(
                db,
                associations_in.dataset_1_id,
                associations_in.dataset_2_id,
                associations_in.axis,
                settings.filestore_location,
                dest_filename,
            )
    except:
        # if add_association_table fails, clean up the sqlite3 file
        os.remove(full_dest_filename)
        # ...before continuing on raising the exception
        raise

    return AssociationTable(
        id=assoc_table.id,
        dataset_1_id=assoc_table.dataset_1_id,
        dataset_2_id=assoc_table.dataset_2_id,
        dataset_1_name=assoc_table.dataset_1.name,
        dataset_2_name=assoc_table.dataset_2.name,
        axis=cast(Literal["sample", "feature"], assoc_table.axis),
    )
