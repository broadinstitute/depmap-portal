"""
Enumerate, for a dimension type, every table reachable by following forward
foreign-key columns, with ready-to-use `reindex_through` SliceQuery templates.

Validity (what is listed) is decided by the chain resolver in `service/slice.py`:
forward FK hops only, scalar or list-valued, no revisiting a type, at most
`_MAX_REINDEX_DEPTH` objects per chain. Presentation is not applied: every
distinct route is listed. `offered_by_picker` marks the ones the Data Explorer
annotation picker (`AnnotationSelect/computeLevel.ts`) also offers.
"""
from dataclasses import dataclass
from typing import Dict, FrozenSet, List, Optional, Set, Tuple

from breadbox.db.session import SessionWithUser
from breadbox.schemas.types import (
    ReachableColumn,
    ReachableHop,
    ReachableRoute,
    ReachableTable,
    ReachableTables,
    SliceQueryChainNode,
    SliceQueryTemplate,
)
from breadbox.service.reference_graph import LoadedTable, load_tables
from breadbox.service.slice import _MAX_REINDEX_DEPTH

# A chain of objects is `hops + 1` long (the data column is the last object).
MAX_HOPS = _MAX_REINDEX_DEPTH - 1

Hop = Tuple[str, str]  # (fk column, target dim type)
OfferKey = Tuple[str, Tuple[Hop, ...], str]  # (start table id, hops, end table id)


@dataclass(frozen=True)
class _PathHop:
    source: LoadedTable
    column: str
    target: str
    cardinality: str


def get_reachable(
    db: SessionWithUser, user: str, index_type: str, max_depth: int
) -> ReachableTables:
    _, tables_by_type = load_tables(db, user)
    if index_type not in tables_by_type:
        raise KeyError(index_type)

    return build_reachable(tables_by_type, index_type, max_depth)


def build_reachable(
    tables_by_type: Dict[str, List[LoadedTable]], index_type: str, max_depth: int
) -> ReachableTables:
    max_depth = min(max_depth, MAX_HOPS)
    offered = picker_offers(tables_by_type, index_type)
    primary: Dict[str, Optional[LoadedTable]] = {
        dim: next((t for t in tables if t.is_primary), None)
        for dim, tables in tables_by_type.items()
    }
    routes: List[ReachableRoute] = []

    def emit(start: LoadedTable, hops: List[_PathHop], end_tables: List[LoadedTable]):
        if not end_tables:
            return
        chain: Optional[SliceQueryChainNode] = None
        for h in hops:
            chain = SliceQueryChainNode(
                dataset_id=h.source.slice_dataset_id,
                identifier=h.column,
                reindex_through=chain,
            )
        hop_key = tuple((h.column, h.target) for h in hops)
        routes.append(
            ReachableRoute(
                start_table=start.slice_dataset_id,
                hops=[
                    ReachableHop(
                        source_dataset_id=h.source.slice_dataset_id,
                        column=h.column,
                        target_type=h.target,
                        cardinality=h.cardinality,  # type: ignore
                    )
                    for h in hops
                ],
                result_is_list=any(h.cardinality == "list" for h in hops),
                tables=[
                    ReachableTable(
                        id=t.id,
                        given_id=t.given_id,
                        slice_dataset_id=t.slice_dataset_id,
                        name=t.name,
                        is_primary=t.is_primary,
                        offered_by_picker=(start.id, hop_key, t.id) in offered,
                        columns=[
                            ReachableColumn(name=c.name, col_type=c.col_type)
                            for c in t.columns
                        ],
                        slice_query_template=SliceQueryTemplate(
                            dataset_id=t.slice_dataset_id, reindex_through=chain,
                        ),
                    )
                    for t in end_tables
                ],
            )
        )

    def walk(
        start: LoadedTable,
        source: LoadedTable,
        hops: List[_PathHop],
        visited: FrozenSet[str],
    ):
        if len(hops) >= max_depth:
            return
        for column in source.edges:
            target = column.references
            assert target is not None
            if target in visited:
                continue
            new_hops = hops + [
                _PathHop(source, column.name, target, column.cardinality)
            ]
            emit(start, new_hops, tables_by_type.get(target, []))
            next_source = primary.get(target)
            if next_source is not None:
                walk(start, next_source, new_hops, visited | {target})

    for start in tables_by_type[index_type]:
        emit(start, [], [start])
        walk(start, start, [], frozenset({index_type}))

    return ReachableTables(index_type=index_type, max_depth=max_depth, routes=routes)


# ── Mirror of the picker's rules (AnnotationSelect/computeLevel.ts, ADR 0013) ──
#
# Kept as a straight port so the cross-language contract test can compare the
# two. String ordering is by code point (the TypeScript uses localeCompare).


def picker_offers(
    tables_by_type: Dict[str, List[LoadedTable]], index_type: str
) -> Set[OfferKey]:
    """Every (start table, hops, end table) the picker lets a user select."""
    offers: Set[OfferKey] = set()
    primary = {
        dim: next((t for t in tables if t.is_primary), None)
        for dim, tables in tables_by_type.items()
    }

    def visit(start: LoadedTable, hops: Tuple[Hop, ...], dim: str):
        visited = {index_type} | {h[1] for h in hops[:-1]}
        level = _compute_level(
            dim,
            index_type,
            tables_by_type,
            primary,
            visited,
            start if not hops else None,
        )
        for auto_path, table_id in level.offers:
            offers.add((start.id, hops + auto_path, table_id))
        for column, target in level.doors:
            visit(start, hops + ((column, target),), target)

    for start in tables_by_type.get(index_type, []):
        visit(start, (), index_type)

    return offers


@dataclass
class _Level:
    doors: List[Hop]
    offers: List[Tuple[Tuple[Hop, ...], str]]


def _compute_level(
    dim: str,
    index_type: str,
    tables_by_type: Dict[str, List[LoadedTable]],
    primary: Dict[str, Optional[LoadedTable]],
    visited: Set[str],
    start_table: Optional[LoadedTable],
) -> _Level:
    visited = set(visited) | {dim}
    active = start_table or primary.get(dim)
    claims, groups_by_dim = _plan_traversal(
        dim, active, tables_by_type, primary, visited
    )

    offers: List[Tuple[Tuple[Hop, ...], str]] = []

    def collect(d: str, path: Tuple[Hop, ...], table: Optional[LoadedTable]):
        for t in tables_by_type.get(d, []):
            is_active = table is not None and t.id == table.id
            # Same-dim supplementals at the index type are offered by the
            # source picker instead (Rule C).
            if is_active or d != index_type:
                offers.append((path, t.id))
        if table is None:
            return
        for target, cols in groups_by_dim.get(d, []):
            claim = claims.get(target)
            if len(cols) == 1 and claim == (d, cols[0]):
                collect(target, path + ((cols[0], target),), primary.get(target))

    collect(dim, (), active)
    doors = [
        (col, target)
        for target, cols in groups_by_dim.get(dim, [])
        if len(cols) >= 2
        for col in cols
    ]
    return _Level(doors=doors, offers=offers)


def _plan_traversal(
    start_dim: str,
    start_table: Optional[LoadedTable],
    tables_by_type: Dict[str, List[LoadedTable]],
    primary: Dict[str, Optional[LoadedTable]],
    visited: Set[str],
):
    claims: Dict[str, Tuple[str, str]] = {}  # target -> (parent dim, fk column)
    paths: Dict[str, Tuple[str, ...]] = {}
    groups_by_dim: Dict[str, List[Tuple[str, List[str]]]] = {}
    excluded = set(visited)
    level = [start_dim]

    def table_for(d: str) -> Optional[LoadedTable]:
        return start_table if d == start_dim else primary.get(d)

    def reachable_from(frm: str) -> Set[str]:
        seen: Set[str] = set()
        stack = [frm]
        while stack:
            cur = stack.pop()
            t = table_for(cur)
            for c in t.edges if t else []:
                if c.references not in excluded and c.references not in seen:
                    seen.add(c.references)  # type: ignore
                    stack.append(c.references)  # type: ignore
        return seen

    while level:
        candidates: Dict[str, List[Tuple[str, str, Tuple[str, ...]]]] = {}

        for d in level:
            t = table_for(d)
            by_target: Dict[str, List[str]] = {}
            # Columns arrive sorted by name; the picker's result does not
            # depend on column order, so neither does this.
            for c in t.edges if t else []:
                if c.references not in excluded:
                    by_target.setdefault(c.references, []).append(c.name)  # type: ignore
            groups = list(by_target.items())
            groups_by_dim[d] = groups

            singles = [(target, cols) for target, cols in groups if len(cols) == 1]
            reach = {target: reachable_from(target) for target, _ in singles}

            for target, cols in singles:
                is_shortcut = any(
                    other != target
                    and target in reach[other]
                    and other not in reach[target]
                    for other, _ in singles
                )
                if not is_shortcut:
                    candidates.setdefault(target, []).append(
                        (d, cols[0], paths.get(d, ()) + (cols[0],))
                    )

        nxt = []
        for target, options in candidates.items():
            parent, col, path = min(options, key=lambda o: ("\u0000".join(o[2]), o[0]))
            claims[target] = (parent, col)
            paths[target] = path
            nxt.append(target)

        nxt.sort()
        excluded.update(nxt)
        level = nxt

    return claims, groups_by_dim
