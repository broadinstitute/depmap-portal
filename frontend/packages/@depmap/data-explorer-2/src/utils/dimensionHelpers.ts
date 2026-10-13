// Pure helpers about dimensions and dimension types. This module must stay free
// of React, browser globals, and import-time side effects: it is part of the
// standalone Node bundle (see embed-frontend/webpack.node.js). Anything that
// needs those belongs in ./misc.ts, which re-exports everything here.
import { breadboxAPI, cached } from "@depmap/api";
import {
  DataExplorerPlotConfigDimension,
  DataExplorerPlotConfigDimensionV2,
  PartialDataExplorerPlotConfigDimension,
  PartialDataExplorerPlotConfigDimensionV2,
} from "@depmap/types";

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

  const isPopulated = (subexpr: any): boolean => {
    if (subexpr == null) {
      return false;
    }

    if (typeof subexpr === "boolean" || typeof subexpr === "number") {
      return true;
    }

    if (typeof subexpr === "string") {
      return subexpr.length > 0;
    }

    if (Array.isArray(subexpr)) {
      return subexpr.every(isPopulated);
    }

    if (typeof subexpr === "object") {
      const values = Object.values(subexpr);
      return values.length > 0 && values.every(isPopulated);
    }

    return false;
  };

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

// Identity predicate for the expansion sentinel. `aggregation === "expansion"`
// is not a real aggregation — its per-pair values come from fetchExpandedPlot,
// not from aggregating a slice. The sentinel rides on `aggregation` to keep
// that field's always-present invariant without a structural redesign. This is
// the one canonical place that knows the sentinel's name; prefer it over
// re-deriving `aggregation === "expansion"` inline. (The two materializer
// guards must stay inline so the compiler narrows `aggregation`; everything
// else asking "is this the expansion axis?" should call this.)
export function isExpansionDimension(
  dimension:
    | PartialDataExplorerPlotConfigDimension
    | PartialDataExplorerPlotConfigDimensionV2
    | null
    | undefined
): boolean {
  return dimension?.aggregation === "expansion";
}

export const isSampleType = (dimensionTypeName: string | null) => {
  if (dimensionTypeName === null) {
    // Datasets can never have a null sample type (only a null feature type).
    return false;
  }

  return cached(breadboxAPI)
    .getDimensionTypes()
    .then((dimTypes) => {
      const dimensionType = dimTypes.find((d) => d.name === dimensionTypeName);

      if (!dimensionType) {
        throw new Error(`Unknown dimension type "${dimensionTypeName}"`);
      }

      return dimensionType.axis === "sample";
    });
};

// FIXME: This is a rather naive implementation.
export const pluralize = (str: string) => {
  if (!str) {
    return "";
  }

  if (str.endsWith("s") || str.toLowerCase().endsWith("metadata")) {
    return str;
  }

  // Special case: The "at" isn't doing much work in the plural case.
  if (str === "Compound at dose") {
    return "Compound doses";
  }

  return `${str.replace(/y$/, "ie")}s`;
};
