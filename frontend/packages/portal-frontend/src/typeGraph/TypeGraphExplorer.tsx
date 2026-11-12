import React, { useEffect, useMemo, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import type {
  DimensionTypeReferenceGraph,
  ReachableRoute,
  ReachableTables,
  ReferenceGraphNode,
} from "@depmap/types";

// Developer tool: explore Breadbox's dimension-type reference graph and the
// chains `GET /types/dimensions/{name}/reachable` offers. Not for end users.

const SIZE = 620;
const CENTER = SIZE / 2;
const RING = 250;

interface Edge {
  from: string;
  to: string;
  count: number;
  hasList: boolean;
}

function buildEdges(graph: DimensionTypeReferenceGraph): Edge[] {
  const byKey = new Map<string, Edge>();

  for (const node of graph.dimension_types) {
    for (const table of node.tables) {
      for (const ref of table.references) {
        const key = `${node.name}\u0000${ref.target_type}`;
        const edge = byKey.get(key) ?? {
          from: node.name,
          to: ref.target_type,
          count: 0,
          hasList: false,
        };

        edge.count += 1;
        edge.hasList = edge.hasList || ref.cardinality === "list";
        byKey.set(key, edge);
      }
    }
  }

  return [...byKey.values()];
}

function RouteList({
  data,
  onlyOffered,
}: {
  data: ReachableTables;
  onlyOffered: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [column, setColumn] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const out: {
      key: string;
      route: ReachableRoute;
      tableIndex: number;
    }[] = [];

    data.routes.forEach((route, r) => {
      route.tables.forEach((table, t) => {
        if (!onlyOffered || table.offered_by_picker) {
          out.push({ key: `${r}:${t}`, route, tableIndex: t });
        }
      });
    });

    return out.sort(
      (a, b) =>
        a.route.hops.length - b.route.hops.length ||
        a.key.localeCompare(b.key, undefined, { numeric: true })
    );
  }, [data, onlyOffered]);

  return (
    <div>
      <div style={{ color: "#666", marginBottom: 6 }}>
        {rows.length} table{rows.length === 1 ? "" : "s"} reachable
      </div>
      {rows.map(({ key, route, tableIndex }) => {
        const table = route.tables[tableIndex];
        const path = [
          route.start_table,
          ...route.hops.map(
            (h) => `${h.column}${h.cardinality === "list" ? " [list]" : ""}`
          ),
          table.slice_dataset_id,
        ].join(" › ");
        const identifier = column[key] ?? table.columns[0]?.name ?? "";
        const template = {
          ...table.slice_query_template,
          identifier,
        };
        // Drop null reindex_through keys, as generating-de2-links.md advises.
        const text = JSON.stringify(
          template,
          (k, v) => (k === "reindex_through" && v === null ? undefined : v),
          2
        );

        return (
          <div
            key={key}
            style={{ borderTop: "1px solid #ddd", padding: "4px 0" }}
          >
            <div
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setOpen(open === key ? null : key)}
              onKeyDown={(e) =>
                e.key === "Enter" && setOpen(open === key ? null : key)
              }
            >
              <span
                style={{
                  display: "inline-block",
                  minWidth: 62,
                  marginRight: 6,
                  padding: "0 4px",
                  fontSize: 11,
                  textAlign: "center",
                  borderRadius: 3,
                  background: table.offered_by_picker ? "#d4edda" : "#eee",
                  color: table.offered_by_picker ? "#155724" : "#777",
                }}
              >
                {table.offered_by_picker ? "offered" : "not offered"}
              </span>
              {route.result_is_list && (
                <span style={{ marginRight: 6, color: "#a60" }}>list</span>
              )}
              <code>{path}</code>
            </div>
            {open === key && (
              <div style={{ margin: "6px 0 6px 12px" }}>
                <label>
                  identifier:{" "}
                  <select
                    value={identifier}
                    onChange={(e) =>
                      setColumn({ ...column, [key]: e.target.value })
                    }
                  >
                    {table.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.col_type})
                      </option>
                    ))}
                  </select>
                </label>{" "}
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(text)}
                >
                  Copy SliceQuery
                </button>
                <pre
                  style={{ marginTop: 6, background: "#f6f6f6", padding: 8 }}
                >
                  {text}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeGraphExplorer() {
  const [graph, setGraph] = useState<DimensionTypeReferenceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(4);
  const [onlyOffered, setOnlyOffered] = useState(false);
  const [reachable, setReachable] = useState<ReachableTables | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    breadboxAPI
      .getDimensionTypeReferenceGraph()
      .then(setGraph)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    setReachable(null);

    if (!selected) return undefined;

    let cancelled = false;

    breadboxAPI
      .getDimensionTypeReachable(selected, { max_depth: maxDepth })
      .then((r) => !cancelled && setReachable(r))
      .catch((e: unknown) => !cancelled && setError(String(e)));

    return () => {
      cancelled = true;
    };
  }, [selected, maxDepth]);

  const edges = useMemo(() => (graph ? buildEdges(graph) : []), [graph]);

  const positions = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    const nodes = graph?.dimension_types ?? [];

    // Types that take part in references go on the ring. Isolated types are
    // listed beside it instead of cluttering the picture.
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    const ring = nodes.filter((n) => linked.has(n.name));

    ring.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;

      out[n.name] = {
        x: CENTER + RING * Math.cos(angle),
        y: CENTER + RING * Math.sin(angle),
      };
    });

    return out;
  }, [graph, edges]);

  const nodeByName = useMemo(
    () =>
      new Map<string, ReferenceGraphNode>(
        (graph?.dimension_types ?? []).map((n) => [n.name, n])
      ),
    [graph]
  );

  const isolated = (graph?.dimension_types ?? []).filter(
    (n) => !positions[n.name]
  );
  const sel = selected ? nodeByName.get(selected) : null;
  const incoming = edges.filter((e) => e.to === selected);

  if (error) {
    return <div style={{ padding: 20, color: "#b00" }}>{error}</div>;
  }

  if (!graph) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        padding: 20,
        alignItems: "flex-start",
      }}
    >
      <div>
        <h3 style={{ marginTop: 0 }}>Dimension type reference graph</h3>
        <svg width={SIZE} height={SIZE} style={{ border: "1px solid #ddd" }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = positions[e.from];
            const b = positions[e.to];

            if (!a || !b) return null;

            const active = e.from === selected || e.to === selected;

            return (
              <line
                key={`${e.from}>${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? "#1565c0" : "#bbb"}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={e.hasList ? "5 3" : undefined}
                markerEnd="url(#arrow)"
              />
            );
          })}
          {Object.entries(positions).map(([name, p]) => {
            const dim =
              filter && name.toLowerCase().includes(filter.toLowerCase());
            const inDegree = edges.filter((e) => e.to === name).length;

            return (
              <g
                key={name}
                transform={`translate(${p.x},${p.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(name)}
              >
                <circle
                  r={6 + Math.min(inDegree, 8)}
                  fill={
                    name === selected ? "#1565c0" : dim ? "#ffb300" : "#fff"
                  }
                  stroke="#555"
                />
                <text
                  y={-12 - Math.min(inDegree, 8)}
                  textAnchor="middle"
                  fontSize={10}
                >
                  {name}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ color: "#666", marginTop: 6, maxWidth: SIZE }}>
          Arrows point from the referencing type to the referenced type. Dashed
          means a list-valued column. Larger circles have more incoming
          references.
        </div>
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="Highlight type…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {isolated.length > 0 && (
          <div style={{ marginTop: 8, maxWidth: SIZE }}>
            No references:{" "}
            {isolated.map((n) => (
              <button
                key={n.name}
                type="button"
                style={{ marginRight: 4, marginBottom: 4 }}
                onClick={() => setSelected(n.name)}
              >
                {n.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!sel ? (
          <div style={{ color: "#666" }}>Select a type.</div>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>
              {sel.display_name} <code>{sel.name}</code>{" "}
              <small>({sel.axis})</small>
            </h3>

            <h4>Tables</h4>
            <ul>
              {sel.tables.map((t) => (
                <li key={t.id}>
                  <code>{t.slice_dataset_id}</code>{" "}
                  {t.is_primary && <b>(primary)</b>}
                  {t.references.map((r) => (
                    <div key={r.column} style={{ marginLeft: 16 }}>
                      {r.column} →{" "}
                      <a
                        href="#!"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelected(r.target_type);
                        }}
                      >
                        {r.target_type}
                      </a>
                      {r.cardinality === "list" && " [list]"}
                    </div>
                  ))}
                </li>
              ))}
            </ul>

            <h4>Referenced by</h4>
            {incoming.length === 0 ? (
              <div style={{ color: "#666" }}>Nothing (not referenced).</div>
            ) : (
              <ul>
                {incoming.map((e) => (
                  <li key={e.from}>
                    <a
                      href="#!"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setSelected(e.from);
                      }}
                    >
                      {e.from}
                    </a>{" "}
                    ({e.count} column{e.count === 1 ? "" : "s"})
                  </li>
                ))}
              </ul>
            )}

            <h4>Reachable from {sel.name}</h4>
            <div style={{ marginBottom: 8 }}>
              <label>
                max_depth{" "}
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={maxDepth}
                  style={{ width: 50 }}
                  onChange={(e) =>
                    setMaxDepth(
                      Math.max(0, Math.min(9, Number(e.target.value) || 0))
                    )
                  }
                />
              </label>{" "}
              <label>
                <input
                  type="checkbox"
                  checked={onlyOffered}
                  onChange={(e) => setOnlyOffered(e.target.checked)}
                />{" "}
                only offered by the picker
              </label>
            </div>
            {reachable ? (
              <RouteList data={reachable} onlyOffered={onlyOffered} />
            ) : (
              <div>Loading…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TypeGraphExplorer;
