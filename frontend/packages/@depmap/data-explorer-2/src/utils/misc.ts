import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
  DimensionType,
  PartialDataExplorerPlotConfig,
  SliceQuery,
} from "@depmap/types";

import { isCompleteDimension, isExpansionDimension } from "./dimensionHelpers";

// HACK: Stash a reference to `dimensionTypes`
// so these utils can be called synchronously.
let dimensionTypes = null as DimensionType[] | null;

if (!process.env.JEST_WORKER_ID) {
  cached(breadboxAPI)
    .getDimensionTypes()
    .then((result) => {
      dimensionTypes = result;
    });
}

export function getDimensionTypeLabel(dimension_type?: string) {
  if (!dimension_type) {
    return "";
  }

  const dimType = (dimensionTypes || []).find(
    ({ name }) => name === dimension_type
  );

  if (dimType?.display_name) {
    return dimType.display_name;
  }

  if (dimension_type === "depmap_model") {
    return "model";
  }

  if (dimension_type === "compound_experiment") {
    return "compound sample";
  }

  if (dimension_type === "msigdb_gene_set") {
    return "MSigDB gene set";
  }

  return (
    dimension_type
      // Explicitly limit the size of input (for no other reason than to shut
      // up GitHub CodeQL which thinks someone might used this to DDoS us 🤦)
      .slice(0, 1000)
      // no underscores
      .replace(/_/g, " ")
      // strip out version suffixes
      .replace(/\s*v?\d+$/i, "")
  );
}

export const isPartialSliceId = (value: string | null) => {
  return Boolean(value?.startsWith("slice/") && value?.endsWith("/"));
};

// Every axis currently expanding, in x-then-y order.
//
// Usually there is exactly one. A second axis can *join* an expansion already
// defined by the first — that's what makes "short-read transcripts vs
// long-read transcripts" expressible, one point per (model, transcript) with a
// different dataset on each axis. Joining axes are indistinguishable from the
// defining one in the config, and deliberately so: both simply expand over the
// same members, so a swap needs no bookkeeping. The distinction is only ever
// presentational — see getExpansionAxis.
export function getExpansionAxes(
  plot: Pick<PartialDataExplorerPlotConfig, "dimensions">
): ("x" | "y")[] {
  return (["x", "y"] as const).filter((key) =>
    isExpansionDimension(plot.dimensions?.[key])
  );
}

// Which axis "owns" the expansion for display purposes: the first one
// expanding, x before y. It is the axis whose context picker stays live, and
// whose selection the plot's `expand_by` mirrors; any other expanding axis
// follows it. Nothing downstream of the config depends on this choice — it
// exists so the UI has exactly one place to edit the member set.
//
// Returns "x" for a plot with no expansion at all, which is meaningless but
// harmless: every caller either has an expansion or ignores the result.
export function getExpansionAxis(
  plot: Pick<PartialDataExplorerPlotConfig, "dimensions">
): "x" | "y" {
  return getExpansionAxes(plot)[0] ?? "x";
}

// A more aggressive version of encodeURIComponent() to match this:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/vector_catalog/models.py#L358
export const urlLibEncode = (s: string) => {
  return encodeURIComponent(s).replace(
    /[()*!']/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
};

// Deprecated: It's preferred to use the async `isSampleType` version.
export const isSampleTypeSync = (
  dimensionTypeName: string | null | undefined
) => {
  if (!dimensionTypeName) {
    return false;
  }

  if (dimensionTypes) {
    const dimensionType = dimensionTypes.find(
      (d) => d.name === dimensionTypeName
    );

    if (dimensionType) {
      return dimensionType.axis === "sample";
    }
  }

  // HACK: Fall back to this hardcoded list if we're in the small
  // temporal window where `dimensionTypes` has not been fetchd yet.
  return ["depmap_model", "ModelCondition", "screen", "tumor"].includes(
    dimensionTypeName
  );
};

// TODO: Remove this. It only exists to support custom analysis in legacy mode.
export function convertDimensionToSliceId(
  dimension: Partial<
    DataExplorerPlotConfigDimension | DataExplorerPlotConfigDimensionV2
  >
) {
  if (!isCompleteDimension(dimension)) {
    return null;
  }

  if (dimension.axis_type !== "raw_slice") {
    throw new Error("Cannot convert a context to a slice ID!");
  }

  const expr = dimension.context.expr as { "==": [object, string] };
  const feature = expr["=="][1];

  return [
    "slice",
    urlLibEncode(dimension.dataset_id),
    urlLibEncode(feature),
    isSampleTypeSync(dimension.slice_type) ? "transpose_label" : "label",
  ].join("/");
}

export async function convertDimensionToSliceQuery(
  dimension: Partial<
    DataExplorerPlotConfigDimension | DataExplorerPlotConfigDimensionV2
  >
): Promise<SliceQuery | undefined> {
  if (!isCompleteDimension(dimension)) {
    return undefined;
  }

  if (dimension.axis_type !== "raw_slice") {
    throw new Error("Cannot convert a context to a slice ID!");
  }

  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimTypes.find((t) => t.name === dimension.slice_type);

  if (dimension.slice_type !== null && !dimType) {
    throw new Error(`Unrecognized dimension type "${dimension.slice_type}"!`);
  }

  const expr = dimension.context.expr as { "==": [unknown, string] };

  if (!expr || typeof expr !== "object" || !("==" in expr)) {
    throw new Error("Malformed context expression.");
  }

  const varExpr = expr["=="][0] as Record<string, unknown>;
  const identifier = expr["=="][1];

  const axis =
    dimension.slice_type === null ? "feature" : dimType?.axis || "sample";
  const idOrLabel =
    "var" in varExpr && varExpr.var === "entity_label" ? "label" : "id";

  const identifier_type = `${axis}_${idOrLabel}` as const;

  return {
    identifier,
    identifier_type,
    dataset_id: dimension.dataset_id,
  };
}

export const useDimensionType = (
  dimensionTypeName: string | null | undefined
) => {
  const [dimensionType, setDimensionType] = useState<DimensionType | null>(
    null
  );
  const [isDimensionTypeLoading, setIsDimensionTypeLoading] = useState(true);

  useEffect(() => {
    cached(breadboxAPI)
      .getDimensionTypes()
      .then((types) => {
        const dt = types.find((t) => t.name === dimensionTypeName);

        if (dt) {
          setDimensionType(dt);
        }

        setIsDimensionTypeLoading(false);
      });
  }, [dimensionTypeName]);

  return { dimensionType, isDimensionTypeLoading };
};

export const capitalize = (str: string) => {
  return str && str.replace(/\b[a-z]/g, (c: string) => c.toUpperCase());
};

export const uncapitalize = (str: string) => {
  return str && str.replace(/\b[A-Z][^A-Z]/g, (s: string) => s.toLowerCase());
};

export const sortDimensionTypes = (typeNames: string[]) => {
  const set = new Set(typeNames);

  const displayNameMap = Object.fromEntries(
    typeNames.map((name) => [
      name,
      (dimensionTypes || []).find((t) => t.name === name)?.display_name ?? name,
    ])
  );

  const sortMapping = Object.fromEntries(
    typeNames.map((name) => [name, displayNameMap[name].toLowerCase()])
  );

  const middle = typeNames
    .filter(
      (name) =>
        ![
          "depmap_model",
          "gene",
          "gene_pair",
          "compound_v2",
          "compound_dose",
          "compound_sample",
          "compound_experiment",
          "other",
          "custom",
          "(dataset specific)",
        ].includes(name)
    )
    .sort((a, b) => (sortMapping[a] < sortMapping[b] ? -1 : 1));

  // prioritize { depmap_model, gene, etc... }
  // and stick { other, custom, etc... } last
  return [
    set.has("depmap_model") ? "depmap_model" : null,
    set.has("gene") ? "gene" : null,
    set.has("gene_pair") ? "gene_pair" : null,
    set.has("compound_v2") ? "compound_v2" : null,
    set.has("compound_dose") ? "compound_dose" : null,
    set.has("compound_sample") ? "compound_sample" : null,
    set.has("compound_experiment") ? "compound_experiment" : null,
    ...middle,
    set.has("other") ? "other" : null,
    set.has("custom") ? "custom" : null,
    set.has("(dataset specific)") ? "(dataset specific)" : null,
  ].filter(Boolean) as string[];
};
