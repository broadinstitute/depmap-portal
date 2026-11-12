from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from breadbox.crud import dimension_types as type_crud
from breadbox.crud.dataset import get_datasets
from breadbox.db.session import SessionWithUser
from breadbox.models.dataset import AnnotationType, DimensionType, TabularDataset
from breadbox.schemas.types import (
    DimensionTypeReferenceGraph,
    ReferenceEdge,
    ReferenceGraphNode,
    ReferenceGraphTable,
)


@dataclass(frozen=True)
class LoadedColumn:
    name: str
    col_type: str
    references: Optional[str]

    @property
    def cardinality(self):
        return (
            "list" if self.col_type == AnnotationType.list_strings.value else "scalar"
        )


@dataclass(frozen=True)
class LoadedTable:
    id: str
    given_id: Optional[str]
    name: str
    data_type: str
    index_type: str
    is_primary: bool
    columns: Tuple[LoadedColumn, ...]  # sorted by name

    @property
    def slice_dataset_id(self) -> str:
        """The value to use as `dataset_id` in a SliceQuery."""
        return self.given_id or self.id

    @property
    def edges(self) -> List[LoadedColumn]:
        return [c for c in self.columns if c.references is not None]


def load_tables(
    db: SessionWithUser, user: str
) -> Tuple[List[DimensionType], Dict[str, List[LoadedTable]]]:
    """
    Load every dimension type and the tabular datasets (tables) indexed by each,
    restricted to datasets visible to `user`. Tables are sorted primary first,
    then by name and id, so output never depends on database row order.
    """
    dimension_types = sorted(type_crud.get_dimension_types(db), key=lambda t: t.name)
    primary_id_by_type = {t.name: t.dataset_id for t in dimension_types}
    tables_by_type: Dict[str, List[LoadedTable]] = {t.name: [] for t in dimension_types}

    for dataset in get_datasets(db, user):
        if not isinstance(dataset, TabularDataset):
            continue
        if dataset.index_type_name not in tables_by_type:
            continue

        columns = sorted(
            (
                LoadedColumn(
                    name=d.given_id,
                    col_type=d.annotation_type.value if d.annotation_type else "",
                    references=d.references_dimension_type_name,
                )
                for d in dataset.dimensions
            ),
            key=lambda c: c.name,
        )
        tables_by_type[dataset.index_type_name].append(
            LoadedTable(
                id=dataset.id,
                given_id=dataset.given_id,
                name=dataset.name,
                data_type=dataset.data_type,
                index_type=dataset.index_type_name,
                is_primary=primary_id_by_type[dataset.index_type_name] == dataset.id,
                columns=tuple(columns),
            )
        )

    for tables in tables_by_type.values():
        tables.sort(key=lambda t: (not t.is_primary, t.name, t.id))

    return dimension_types, tables_by_type


def get_reference_graph(db: SessionWithUser, user: str) -> DimensionTypeReferenceGraph:
    """
    Describe every dimension type, the tabular datasets indexed by it, and the
    columns in those tables that reference other dimension types.

    Only datasets visible to `user` are included, so the graph never reveals the
    existence or columns of private tables.
    """
    dimension_types, tables_by_type = load_tables(db, user)

    nodes = []
    for dim_type in dimension_types:
        tables = tables_by_type[dim_type.name]
        primary = next((t for t in tables if t.is_primary), None)
        nodes.append(
            ReferenceGraphNode(
                name=dim_type.name,
                display_name=dim_type.display_name,
                axis=dim_type.axis,
                metadata_dataset_id=primary.id if primary else None,
                tables=[
                    ReferenceGraphTable(
                        id=t.id,
                        given_id=t.given_id,
                        slice_dataset_id=t.slice_dataset_id,
                        name=t.name,
                        data_type=t.data_type,
                        is_primary=t.is_primary,
                        references=[
                            ReferenceEdge(
                                column=c.name,
                                target_type=c.references,
                                cardinality=c.cardinality,
                            )
                            for c in t.edges
                        ],
                    )
                    for t in tables
                ],
            )
        )

    return DimensionTypeReferenceGraph(dimension_types=nodes)
