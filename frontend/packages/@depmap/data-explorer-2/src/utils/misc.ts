import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
  DimensionType,
  PartialDataExplorerPlotConfigDimension,
  PartialDataExplorerPlotConfigDimensionV2,
  SliceQuery,
} from "@depmap/types";
import { isV2Context } from "./context";

export function getDimensionTypeLabel(dimension_type?: string) {
  if (!dimension_type) {
    return "";
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

export const isCompleteExpression = (expr: any) => {
  if (expr == null) {
    return false;
  }

  if (typeof expr === "boolean") {
    return true;
  }

  if (expr.and && expr.and.length === 0) {
    return false;
  }

  if (expr.or && expr.or.length === 0) {
    return false;
  }

  const getValues = (subexpr: any) => {
    const op = Object.keys(subexpr)[0];
    return subexpr[op];
  };

  const isPopulated = (subexpr: any): boolean =>
    Array.isArray(subexpr && getValues(subexpr))
      ? getValues(subexpr).every(isPopulated)
      : Boolean(subexpr || subexpr === 0);

  return isPopulated(expr);
};

export function isCompleteDimension(
  dimension:
    | PartialDataExplorerPlotConfigDimension
    | PartialDataExplorerPlotConfigDimensionV2
    | null
    | undefined
): dimension is
  | DataExplorerPlotConfigDimension
  | DataExplorerPlotConfigDimensionV2 {
  if (!dimension) {
    return false;
  }

  const { dataset_id, slice_type, axis_type, context, aggregation } = dimension;

  const isValidSliceType =
    typeof slice_type === "string" || slice_type === null;

  return Boolean(
    dataset_id &&
      isValidSliceType &&
      axis_type &&
      aggregation &&
      isCompleteExpression(context?.expr)
  );
}

export const isPartialSliceId = (value: string | null) => {
  return Boolean(value?.startsWith("slice/") && value?.endsWith("/"));
};

// A more aggressive version of encodeURIComponent() to match this:
// https://github.com/broadinstitute/depmap-portal/blob/a2e2cc9/portal-backend/depmap/vector_catalog/models.py#L358
export const urlLibEncode = (s: string) => {
  return encodeURIComponent(s).replace(
    /[()*!']/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
};

export const isSampleType = (
  dimensionTypeName: string | null | undefined,
  // FIXME: this second arg is optional to support some legacy code. Once we
  // move all data to Breadbox, this should become required.
  dimensionTypes?: DimensionType[]
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

  return [
    "anchor_experiment",
    "anchor_experiment_v2",
    "depmap_model",
    "ModelCondition",
    "Screen metadata",
    "tumor",
  ].includes(dimensionTypeName);
};

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

  if (isSampleType(dimension.slice_type)) {
    throw new Error(
      "Cannot convert a sample to a slice ID! Only features are supported."
    );
  }

  const expr = dimension.context.expr as { "==": [object, string] };
  const feature = expr["=="][1];

  return [
    "slice",
    urlLibEncode(dimension.dataset_id),
    urlLibEncode(feature),
    "label",
  ].join("/");
}

export async function convertDimensionToSliceQuery(
  dimension: Partial<
    DataExplorerPlotConfigDimension | DataExplorerPlotConfigDimensionV2
  >
): Promise<SliceQuery | null> {
  if (!isCompleteDimension(dimension)) {
    return null;
  }

  if (dimension.axis_type !== "raw_slice") {
    throw new Error("Cannot convert a context to a slice ID!");
  }

  if (!isV2Context(dimension.context) && isSampleType(dimension.slice_type)) {
    throw new Error(
      "Cannot convert a sample to a slice ID! Only features are supported."
    );
  }

  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimension.slice_type);

  if (dimension.slice_type !== null && !dimType) {
    throw new Error(`Unrecognized dimension type "${dimension.slice_type}"!`);
  }

  const expr = dimension.context.expr as { "==": [unknown, string] };

  if (!expr || typeof expr !== "object" || !("==" in expr)) {
    throw new Error("Malformed context expression.");
  }

  const varExpr = expr["=="][0] as Record<string, unknown>;
  const identifier = expr["=="][1];

  const axis = dimType?.axis || "sample";
  const idOrLabel =
    "var" in varExpr && varExpr.var === "entity_label" ? "label" : "id";

  const identifier_type = `${axis}_${idOrLabel}` as const;

  return {
    identifier,
    identifier_type,
    dataset_id: dimension.dataset_id,
  };
}

export const useDimensionType = (dimensionTypeName: string | null) => {
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

// FIXME: This is a rather naive implementation.
export const pluralize = (str: string) => {
  if (!str) {
    return "";
  }

  if (
    str.toLowerCase() === "other" ||
    str.endsWith("s") ||
    str.toLowerCase().endsWith("metadata")
  ) {
    return str;
  }

  return `${str.replace(/y$/, "ie")}s`;
};

export const sortDimensionTypes = (
  typeNames: string[],
  displayNames?: string[]
) => {
  const set = new Set(typeNames);

  const mapping = Object.fromEntries(
    typeNames.map((name, i) => [
      name,
      (displayNames ? displayNames[i] : typeNames[i]).toLowerCase(),
    ])
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
    .sort((a, b) => (mapping[a] < mapping[b] ? -1 : 1));

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
