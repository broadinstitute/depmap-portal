import os.path
from typing import Annotated

from depmap_compute.slice import SliceQuery
from fastapi import APIRouter, Body, Depends, HTTPException
from itsdangerous import URLSafeSerializer

from breadbox.api.dependencies import get_db_with_user, get_cas_db_path
from breadbox.config import Settings, get_settings
from breadbox.crud import types as types_crud
from breadbox.schemas.custom_http_exception import UserError
from breadbox.db.session import SessionWithUser
from breadbox.schemas.context import (
    Context,
    ContextMatchResponse,
)
from breadbox.schemas.cas import CASKey, CASValue
from breadbox.service import slice as slice_service

from depmap_compute.context import ContextEvaluator
from breadbox.io import cas
from breadbox.api.uploads import construct_file_from_ids
from breadbox.schemas.associations import Associations
from breadbox.schemas.associations import AssociationTable, AssociationsIn, Association
from typing import List
from breadbox.service import associations as associations_service
from breadbox.crud import associations as associations_crud
import uuid
from breadbox.db.util import transaction

# This temp prefix is intended to convey to API users that these contracts may change.
# Most of these endpoints are intended to support feature-specific functionality
router = APIRouter(prefix="/temp", tags=["temp"])

# Methods for getting/setting values in Content-addressable-storage (CAS)
@router.get(
    "/cas/{key}", operation_id="get_cas_value", response_model=CASValue,
)
def get_cas_value(key: str, cas_db_path: Annotated[str, Depends(get_cas_db_path)]):
    value = cas.get_value(cas_db_path, key)
    if value is None:
        raise HTTPException(status_code=404)
    return CASValue(value=value)


@router.post(
    "/cas", operation_id="set_cas_value", response_model=CASKey,
)
def set_cas_value(
    value: CASValue, cas_db_path: Annotated[str, Depends(get_cas_db_path)]
):
    key = cas.set_value(cas_db_path, value.value)
    return CASKey(key=key)


@router.post(
    "/context",
    operation_id="evaluate_context",
    response_model=ContextMatchResponse,
    response_model_exclude_none=False,
)
def evaluate_context(
    db: Annotated[SessionWithUser, Depends(get_db_with_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    context: Annotated[
        Context, Body(description="A Data Explorer 2 context expression")
    ],
):
    """
    Get the full list of IDs and labels (in any dataset) which match the given context.
    Also get the total number of "candidate" records (all records with labels belonging to the dimension type).
    Requests must be in the version 2 context format. 
    """
    slice_loader_function = lambda slice_query: slice_service.get_slice_data(
        db, settings.filestore_location, slice_query
    )
    context_evaluator = ContextEvaluator(context.dict(), slice_loader_function)

    # Load all dimension labels and ids
    all_labels_by_id = types_crud.get_dimension_type_labels_by_id(
        db, context.dimension_type
    )

    # Evaluate each against the context
    matching_ids = []
    matching_labels = []
    try:
        for given_id, label in all_labels_by_id.items():
            if context_evaluator.is_match(given_id):
                matching_ids.append(given_id)
                matching_labels.append(label)
    except LookupError as e:
        # This happens when the request is malformed
        raise UserError(f"Encountered lookup error: {e}")

    return ContextMatchResponse(
        ids=matching_ids,
        labels=matching_labels,
        num_candidates=len(all_labels_by_id.keys()),
    )


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
        SliceQuery, Body(description="A Data Explorer 2 context expression")
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
            id=a.id, dataset_1_id=a.dataset_1_id, dataset_2_id=a.dataset_2_id
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

    os.rename(full_file, full_dest_filename)

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
    )
