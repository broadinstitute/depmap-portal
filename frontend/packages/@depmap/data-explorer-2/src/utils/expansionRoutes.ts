import {
  breadboxAPI,
  cached,
  getDimensionTypeIdentifiersPersisted,
} from "@depmap/api";
import { DataExplorerContextV2 } from "@depmap/types";
import { capitalize, getDimensionTypeLabel, pluralize } from "./misc";

// A way one dimension type can be expanded into the members associated with
// some other entity — "the transcripts of a gene", "the doses of a compound",
// "the antibodies targeting a gene".
//
// Mostly this is parenthood, and the first two read that way. It isn't
// required to be: many genes encode the same protein, so an antibody belongs to
// several genes at once (see `reindex.manyParents`). What every route does have
// to be is a set the user can name by picking ONE entity.
//
// The point of naming these is that the resulting context is mechanical, and
// increasingly non-obvious. A transcript route is one equality on one column,
// which a determined user could assemble by hand; an antibody route is a
// reindex through a foreign key plus a list-membership operator, which nobody
// is going to discover from the interface. Removing that friction is the whole
// job here, and it grows with the complexity of the route.
export interface ExpansionRoute {
  // The type the user picks ONE of, e.g. "gene".
  parentType: string;

  // The column on the CHILD's metadata dataset holding the parent reference.
  column: string;

  // Which side of the picked parent ends up in the expression. This is not
  // incidental — get it wrong and the generated context silently matches
  // nothing. `transcript_metadata.Gene` holds gene *symbols*, while
  // `compound_dose_metadata.CompoundID` holds real given_ids.
  matchOn: "id" | "label";

  // Present when `column` doesn't hold the value to match but a reference that
  // has to be followed to reach it. The expression then reads a column off the
  // PARENT's own metadata, reindexed through `column`.
  //
  // antibody_v2 is the case. `target_entrez_id` holds gene ids, but the user
  // picks a gene by symbol, so matching directly against `column` would compare
  // a symbol to an id and find nothing. Following the reference to
  // `gene_metadata.label` is what makes the comparison meaningful.
  reindex?: {
    // Column on the PARENT's metadata whose value the expression matches. Says
    // the same thing `matchOn` does, from the other end: `matchOn` picks which
    // side of the selection to write down, this picks which column it is
    // compared against, and the two have to describe the same quantity.
    parentColumn: string;

    // Whether one child can reference several parents. Reindexing through such
    // a column promotes each child's value to a list, so membership becomes
    // `has_any` rather than `==`.
    //
    // Not a defensive default: many genes encode the same protein, so an
    // antibody really does have several, and this is the field that stops the
    // route from being modeled as parenthood when it isn't.
    manyParents: boolean;
  };

  // What to call the members in "<members> of a <parent>", when the dimension
  // type's own display name reads badly there. Optional; defaults to the
  // display name, singular and pluralized.
  //
  // compound_dose is the case that needs it: its display name is "Compound at
  // dose", which becomes "Compounds At Doses of a compound" — the "Compound"
  // is already carried by the parent, so it just reads as a stutter. Spelled
  // out as both forms rather than singularized by rule, since there is no
  // reliable way back from a plural.
  memberNoun?: { one: string; other: string };
}

// Which types can be expanded, and how.
//
// This is deliberately a local table rather than something derived from
// Breadbox metadata. Breadbox *does* record a typed column→dimension-type edge
// (`ColumnMetadata.references`), and `computeLevel` in @depmap/selects already
// walks it — but it means "these values are ids of type Y", which is not
// parenthood. `compound_v2` metadata references `gene` through
// `EntrezIDsOfTargets`; deriving from it would offer to expand a compound into
// the genes it targets. ADR 0006 §5 is explicit that the model has no way to
// assert the uniqueness parenthood implies.
//
// So the relationship has to be declared. The intended end state is a field on
// Breadbox's `DimensionType`, at which point ONLY this constant changes and
// every caller stays as it is. That is the same shape `getDimensionTypeLabel`
// already uses: prefer server metadata, fall back to a local map.
//
const ROUTES: Record<string, ExpansionRoute[]> = {
  // `transcript_metadata.Gene` holds gene SYMBOLS, not gene ids, so the
  // expression has to match the picked gene's label.
  transcript: [{ parentType: "gene", column: "Gene", matchOn: "label" }],

  // `compound_dose_metadata.CompoundID` is a real foreign key holding
  // compound_v2 given_ids, so this matches on id. That's independent of how
  // the user finds the compound — the picker searches compound_v2 by label, so
  // you type "afatinib" and the generated expression carries its id.
  //
  // Two rough edges, neither fatal but both visible:
  //
  //  - Dose ordering. A compound_dose given_id is "{compound_id} {dose}
  //    {unit}", so ordering members alphabetically puts "0.0025 uM" next to
  //    "10 uM". `expand_by` has no way to order by a column (the `Dose` column
  //    exists for exactly this), so faceted doses will not read left-to-right
  //    in dose order until it does.
  //  - A compound's doses span screens (Repurposing, OncRef, GDSC2) with
  //    different ladders, so "all doses of X" is a union across them. The
  //    axis's own dataset then has no values for the other screens' doses,
  //    which spends the expansion's member cap on empty facets.
  compound_dose: [
    {
      parentType: "compound_v2",
      column: "CompoundID",
      matchOn: "id",
      memberNoun: { one: "dose", other: "doses" },
    },
  ],

  // The one route that isn't parenthood. `antibody_v2_metadata.target_entrez_id`
  // holds gene ids, and a single antibody can name several, because several
  // genes can encode the protein it binds. So the value is a list once
  // reindexed, and membership is `has_any`.
  //
  // Matching on label rather than id even though the column holds ids: the
  // reindex reads `gene_metadata.label`, so what the expression compares
  // against is a symbol. Written this way because the user picks the gene by
  // symbol and a saved context is then legible ("AKT1" rather than "207").
  antibody_v2: [
    {
      parentType: "gene",
      column: "target_entrez_id",
      matchOn: "label",
      reindex: { parentColumn: "label", manyParents: true },
    },
  ],
};

// The nouns this route is described with, everywhere it's described. Both the
// dropdown option and the modal that option opens go through here, because
// they were previously built from the same expression written out twice and
// had already drifted apart on screen.
export function getRouteNouns(childType: string, route: ExpansionRoute) {
  const displayName = getDimensionTypeLabel(childType) || childType;

  return {
    member: route.memberNoun?.one ?? displayName,
    members: route.memberNoun?.other ?? pluralize(displayName),
    parent: getDimensionTypeLabel(route.parentType) || route.parentType,
  };
}

// "Doses of a compound" — the option's label and the modal's title, which must
// agree or the modal looks like it opened the wrong thing.
export function getRouteHeading(childType: string, route: ExpansionRoute) {
  const { members, parent } = getRouteNouns(childType, route);

  return `${capitalize(members)} of a ${parent.toLowerCase()}`;
}

export function getExpansionRoutes(
  childType: string | null | undefined
): ExpansionRoute[] {
  if (!childType) {
    return [];
  }

  return ROUTES[childType] ?? [];
}

// The child's metadata table is where the parent column lives. It's already a
// property of the dimension type, so only the column and parent need naming
// above.
//
// `metadata_dataset_id` is Breadbox's internal dataset id — a UUID pinned to
// one specific version. A generated context outlives the moment it was made
// (it can be saved, shared, or encoded into a link), so it should reference
// the dataset by `given_id`, which is stable across releases and always
// resolves to the current version. Falls back to the raw id for the rare
// dataset with no given_id, since a pinned reference beats none.
async function fetchMetadataDatasetRef(childType: string) {
  const [dimensionTypes, datasets] = await Promise.all([
    cached(breadboxAPI).getDimensionTypes(),
    cached(breadboxAPI).getDatasets(),
  ]);

  const datasetId = dimensionTypes.find((t) => t.name === childType)
    ?.metadata_dataset_id;

  if (!datasetId) {
    return null;
  }

  // Matched on either field: callers upstream are inconsistent about which
  // one they hold, and this is cheap insurance against being handed a
  // given_id here in the first place.
  const dataset = datasets.find(
    (d) => d.id === datasetId || d.given_id === datasetId
  );

  return dataset?.given_id || datasetId;
}

// Builds the context a route implies. Structurally identical to what
// Transcript Explorer has hand-written since the feature shipped — that
// version is the reference this is checked against in tests.
export async function toParentContext(
  childType: string,
  route: ExpansionRoute,
  parent: { id: string; label: string }
): Promise<DataExplorerContextV2 | null> {
  const metadataDatasetRef = await fetchMetadataDatasetRef(childType);

  if (!metadataDatasetRef) {
    return null;
  }

  // Named "0", not something descriptive like "gene". Context Builder runs
  // every context it saves through `simplifyVarNames`, which renumbers
  // variables from zero in expression order — so a context generated here and
  // the same context round-tripped through the builder have to agree on the
  // name, or they hash differently and get saved as two copies of the same
  // thing. A single-rule context always numbers to "0".
  const varName = "0";

  // Which side of the picked parent the expression carries. For a reindexed
  // route this is compared against `reindex.parentColumn` on the parent's own
  // metadata; otherwise against `column` on the child's.
  const matched = route.matchOn === "id" ? parent.id : parent.label;

  // A reindexed route reads the PARENT's metadata, reached through the child's.
  // Both refs are resolved the same way, so the only new thing here is that
  // there are two of them.
  const parentDatasetRef = route.reindex
    ? await fetchMetadataDatasetRef(route.parentType)
    : null;

  if (route.reindex && !parentDatasetRef) {
    return null;
  }

  const variable = route.reindex
    ? {
        dataset_id: parentDatasetRef as string,
        identifier: route.reindex.parentColumn,
        identifier_type: "column" as const,
        reindex_through: {
          dataset_id: metadataDatasetRef,
          identifier: route.column,
          identifier_type: "column" as const,
        },
        source: "property" as const,
      }
    : {
        dataset_id: metadataDatasetRef,
        identifier: route.column,
        identifier_type: "column" as const,
        source: "property" as const,
      };

  // Reindexing through a column that can name several parents makes each
  // child's value a list, which `==` cannot compare against. The right-hand
  // side becomes a one-element list because a route always describes a single
  // picked parent — `has_any` is doing membership here, not a union.
  const expr = route.reindex?.manyParents
    ? { has_any: [{ var: varName }, [matched]] }
    : { "==": [{ var: varName }, matched] };

  return {
    // Named for what it contains, not for the parent alone. Transcript
    // Explorer names this bare "CD44", which reads as a gene sitting in a list
    // of transcript contexts.
    //
    // Uses the same noun as the option and modal that produced it, so a saved
    // context reads as the thing the user asked for ("afatinib Doses", not
    // "afatinib Compound Doses"). Capitalized explicitly rather than trusting
    // the display name, since getDimensionTypeLabel falls back to munging the
    // raw type name before the dimension types are cached and the casing would
    // otherwise depend on load order.
    name: `${parent.label} ${capitalize(
      getRouteNouns(childType, route).members
    )}`,
    dimension_type: childType,
    expr,
    vars: { [varName]: variable },
  };
}

// Reads a parent selection back out of a context this module generated, so the
// picker can show what's currently chosen. Returns null for any context that
// isn't one of ours — a hand-built context of the same type is perfectly
// valid, it just isn't a parent pick.
//
// Only the matched value is recoverable — the context stores whichever side of
// the parent its column holds, never both — so `id` and `label` come back as
// the same string. For a `matchOn: "label"` route that's already correct. For
// an id-matched one the label is a stand-in; pass the result through
// `resolveParentLabel` to turn "DPC-000001" back into "afatinib".
export function fromParentContext(
  context: DataExplorerContextV2 | null | undefined,
  route: ExpansionRoute
): { id: string; label: string } | null {
  const expr = context?.expr;
  const isListMembership = Boolean(route.reindex?.manyParents);
  const operator = isListMembership ? "has_any" : "==";

  // Arrays are rejected explicitly. A right-hand side can be one, but a
  // top-level expression never is, and `operator in expr` would happily accept
  // an array that happened to have the key.
  if (
    !expr ||
    typeof expr !== "object" ||
    Array.isArray(expr) ||
    !(operator in expr)
  ) {
    return null;
  }

  const [variable, rhs] = (expr as Record<string, [{ var?: string }, unknown]>)[
    operator
  ];

  // `has_any` takes a list. Only a single-element one is ours: a route always
  // describes one picked parent, so anything longer is a hand-built context
  // that happens to share the shape, and reporting one of its values as "the
  // selection" would misrepresent it.
  const matched =
    isListMembership && Array.isArray(rhs) && rhs.length === 1 ? rhs[0] : rhs;

  if (typeof matched !== "string" || !variable?.var) {
    return null;
  }

  // Confirm the variable really points where this route points, rather than
  // trusting the expression's shape alone.
  const contextVar = context?.vars?.[variable.var];

  if (contextVar?.identifier_type !== "column") {
    return null;
  }

  if (route.reindex) {
    if (
      contextVar.identifier !== route.reindex.parentColumn ||
      contextVar.reindex_through?.identifier !== route.column ||
      contextVar.reindex_through?.identifier_type !== "column"
    ) {
      return null;
    }
  } else if (contextVar.identifier !== route.column) {
    return null;
  }

  return { id: matched, label: matched };
}

// Recovers the human-readable label for a selection that came back out of a
// context. Only id-matched routes need it: their column stores the parent's id,
// so the picker would otherwise redisplay a bare given_id ("DPC-000001") where
// the user expects the name they searched for ("afatinib").
//
// Falls back to the selection as-is rather than failing, so an id that's no
// longer in the dimension type still shows something.
export async function resolveParentLabel(
  route: ExpansionRoute,
  selection: { id: string; label: string }
): Promise<{ id: string; label: string }> {
  if (route.matchOn === "label") {
    return selection;
  }

  const identifiers = await getDimensionTypeIdentifiersPersisted(
    route.parentType
  );

  return identifiers.find((i) => i.id === selection.id) ?? selection;
}
