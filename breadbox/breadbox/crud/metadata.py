from typing import Any, Dict, List
import json

import pandas as pd
from sqlalchemy import and_, or_

from breadbox.db.session import SessionWithUser
from breadbox.crud.group import get_groups_with_visible_contents
from breadbox.models.dataset import (
    AnnotationType,
    TabularColumn,
    TabularCell,
    Dataset,
    Dimension,
)
from breadbox.schemas.metadata import MetadataResponse, FormattedMetadata


def _get_dataset_filter_clauses(db: SessionWithUser, user: str):

    # Get groups for which the user has read-access
    groups = get_groups_with_visible_contents(db, user)
    group_ids = [group.id for group in groups]

    filter_clauses = [Dataset.group_id.in_(group_ids)]  # pyright: ignore
    # Don't return transient datasets
    filter_clauses.append(Dataset.is_transient == False)

    return filter_clauses


from typing import List, Union, cast


def cast_tabular_cell_value_type(value, type) -> Union[None, str, float, List[str]]:
    if value == None:
        return None
    if type == AnnotationType.binary:
        # NOTE: pandas dtype boolean in _validate_dimension_type_metadata_file standardizes booleans to True and False
        return True if value == "True" else False
    if type == AnnotationType.categorical:
        return str(value)
    if type == AnnotationType.continuous:
        return float(value)
    if type == AnnotationType.text:
        return str(value)
    if type == AnnotationType.list_strings:
        value_ = json.loads(value)
        assert isinstance(value_, list)
        return cast(List[str], value_)
    raise Exception(f"unhandled type: {type}")


def _get_metadata_as_name_value_list(df: pd.DataFrame):
    # Assert the sample or feature id column is just 1 dimension_given_id
    id_vals = df["dimension_given_id"].to_numpy()

    # Samples and features could exist without metadata
    formatted_metadata: List[Dict[str, Any]] = []
    if len(id_vals) > 0:

        assert (id_vals[0] == id_vals).all()

        for index, row in df[["given_id", "value", "annotation_type"]].iterrows():
            formatted_metadata.append(
                {
                    "given_id": row["given_id"],
                    "value": cast_tabular_cell_value_type(
                        row["value"], row["annotation_type"]
                    ),
                    "annotation_type": row["annotation_type"].value,
                }
            )

    return formatted_metadata


# Example:
#                      value    dimension_given_id              given_id            annotation_type
# 0   CADO-ES-1,CADOES1_BONE            ACH-000210               aliases        AnnotationType.text
# 1                     bone            ACH-000210             lineage_1        AnnotationType.text
# 2             CADOES1_BONE            ACH-000210        cell_line_name        AnnotationType.text
# 3                     KCLB            ACH-000210                source        AnnotationType.text
# 4                CVCL_0698            ACH-000210                  rrid        AnnotationType.text
def _get_feature_or_sample_metadata_df(
    db: SessionWithUser, label_or_id: str
) -> pd.DataFrame:
    """DEPRECATED: Remove after Elara metadata support is updated."""
    query = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            or_(
                TabularCell.dimension_given_id == label_or_id,
                and_(
                    TabularColumn.given_id == "label", TabularCell.value == label_or_id,
                ),
            )
        )
        .with_entities(
            TabularCell.value,
            TabularCell.dimension_given_id,
            TabularColumn.given_id,
            TabularColumn.annotation_type,
        )
    )
    metadata_df = pd.read_sql(query.statement, query.session.connection())

    return metadata_df


def format_feature_or_sample_metadata(metadata_df: pd.DataFrame, label_or_id: str):
    # TODO: Having more than one row signifies there are multiple features or samples with same label. Not sure if this needs to be accounted for yet...
    formatted_metadata = _get_metadata_as_name_value_list(metadata_df)
    # TODO: Is this right behavior? Return label as the label_or_id that was given in query
    labeled_metadata = MetadataResponse(
        label=label_or_id, metadata=[FormattedMetadata(**x) for x in formatted_metadata]
    )
    return labeled_metadata


def get_metadata_search_options(db: SessionWithUser, user: str, text: str):
    # Make sure the user's group has read access
    dataset_filter_clauses = _get_dataset_filter_clauses(db, user)
    dimension_query_filters = dataset_filter_clauses

    dimension_query_filters.append(Dimension.given_id.startswith(text))
    dimension_query_filters.append(
        or_(
            Dimension.subtype == "dataset_sample",
            Dimension.subtype == "dataset_feature",
        )
    )

    # Search for features or samples because features don't need to have
    # the feature_label column filled out. We still want to capture these
    # with dimension name.
    dimension_search_query = (
        db.query(Dimension)
        .join(Dataset, Dimension.dataset_id == Dataset.id)
        .filter(and_(True, *dimension_query_filters))
        .order_by(Dimension.given_id)
        .limit(20)
        .distinct()
        .with_entities(Dimension.given_id)
    )

    dimension_names = pd.read_sql(
        dimension_search_query.statement, dimension_search_query.session.connection()
    )
    dimension_names_list = dimension_names["given_id"].tolist()

    names_list = sorted(dimension_names_list)

    return names_list


# Get list of metadata for a given feature or sample label to load into dropdown on Elara Metadata Page.
def get_metadata_list_for_dimension_label(
    db: SessionWithUser, label_or_id: str
) -> MetadataResponse:
    """DEPRECATED: Remove after Elara metadata support is updated."""
    metadata_df = _get_feature_or_sample_metadata_df(db, label_or_id)
    return format_feature_or_sample_metadata(metadata_df, label_or_id)
