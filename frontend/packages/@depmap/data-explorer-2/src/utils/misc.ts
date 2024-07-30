import { DataExplorerPlotConfigDimension } from "@depmap/types";

export function getDimensionTypeLabel(entity_type: string) {
  if (!entity_type) {
    return "";
  }

  if (entity_type === "depmap_model") {
    return "model";
  }

  if (entity_type === "compound_experiment") {
    return "compound";
  }

  if (entity_type === "msigdb_gene_set") {
    return "MSigDB gene set";
  }

  return (
    entity_type
      // no underscores
      .replace(/_/g, " ")
      // strip out version suffixes
      .replace(/\s*[vV]?\d+$/, "")
  );
}

export function getEntityGroupLabel(entity_type: string) {
  if (entity_type === "depmap_model") {
    return "DepMap ID";
  }

  if (entity_type === "gene") {
    return "gene name";
  }

  return getDimensionTypeLabel(entity_type);
}

export const isCompleteExpression = (expr: any) => {
  if (expr == null) {
    return false;
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
  dimension: Partial<DataExplorerPlotConfigDimension> | null | undefined
): dimension is DataExplorerPlotConfigDimension {
  if (!dimension) {
    return false;
  }

  const {
    dataset_id,
    entity_type,
    axis_type,
    context,
    aggregation,
  } = dimension;

  return Boolean(
    dataset_id &&
      entity_type &&
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

export const isSampleType = (entityType: string | null | undefined) => {
  return ["depmap_model", "screen", "model_condition"].includes(
    entityType as string
  );
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

export const sortDimensionTypes = (types: string[]) => {
  const set = new Set(types);

  const middle = types
    .filter(
      (type) =>
        ![
          "depmap_model",
          "gene",
          "gene pair",
          "compound_experiment",
          "other",
          "custom",
        ].includes(type)
    )
    .sort(Intl.Collator("en").compare);

  // prioritize { depmap_model, gene, compound_experiment } and stick
  // { other, custom } last
  return [
    set.has("depmap_model") ? "depmap_model" : null,
    set.has("gene") ? "gene" : null,
    set.has("gene pair") ? "gene pair" : null,
    set.has("compound_experiment") ? "compound_experiment" : null,
    ...middle,
    set.has("other") ? "other" : null,
    set.has("custom") ? "custom" : null,
  ].filter(Boolean) as string[];
};
