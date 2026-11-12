from typing import Dict, List

from breadbox.crud import dimension_types as type_crud
from breadbox.crud.dataset import get_datasets
from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType, TabularDataset
from breadbox.schemas.types import (
    DimensionTypeReferenceGraph,
    ReferenceEdge,
    ReferenceGraphNode,
    ReferenceGraphTable,
)


def get_reference_graph(db: SessionWithUser, user: str) -> DimensionTypeReferenceGraph:
    """
    Describe every dimension type, the tabular datasets indexed by it, and the
    columns in those tables that reference other dimension types.

    Only datasets visible to `user` are included, so the graph never reveals the
    existence or columns of private tables. Output is sorted so it does not
    depend on database row order.
    """
    dimension_types = type_crud.get_dimension_types(db)

    tables_by_type: Dict[str, List[ReferenceGraphTable]] = {
        t.name: [] for t in dimension_types
    }
    visible_primary_ids = set()
    primary_id_by_type = {t.name: t.dataset_id for t in dimension_types}

    for dataset in get_datasets(db, user):
        if not isinstance(dataset, TabularDataset):
            continue
        if dataset.index_type_name not in tables_by_type:
            continue

        is_primary = primary_id_by_type[dataset.index_type_name] == dataset.id
        if is_primary:
            visible_primary_ids.add(dataset.id)

        edges = [
            ReferenceEdge(
                column=column.given_id,
                target_type=column.references_dimension_type_name,
                cardinality="list"
                if column.annotation_type == AnnotationType.list_strings
                else "scalar",
            )
            for column in dataset.dimensions
            if column.references_dimension_type_name is not None
        ]
        edges.sort(key=lambda e: e.column)

        tables_by_type[dataset.index_type_name].append(
            ReferenceGraphTable(
                id=dataset.id,
                given_id=dataset.given_id,
                slice_dataset_id=dataset.given_id or dataset.id,
                name=dataset.name,
                data_type=dataset.data_type,
                is_primary=is_primary,
                references=edges,
            )
        )

    nodes = []
    for dim_type in sorted(dimension_types, key=lambda t: t.name):
        tables = sorted(
            tables_by_type[dim_type.name],
            key=lambda t: (not t.is_primary, t.name, t.id),
        )
        nodes.append(
            ReferenceGraphNode(
                name=dim_type.name,
                display_name=dim_type.display_name,
                axis=dim_type.axis,
                metadata_dataset_id=dim_type.dataset_id
                if dim_type.dataset_id in visible_primary_ids
                else None,
                tables=tables,
            )
        )

    return DimensionTypeReferenceGraph(dimension_types=nodes)
