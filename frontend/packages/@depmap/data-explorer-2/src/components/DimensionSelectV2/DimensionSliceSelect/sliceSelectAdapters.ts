import { DataExplorerContextV2 } from "@depmap/types";

interface SliceSelection {
  id: string;
  label: string;
}

/**
 * Converts a DataExplorerContextV2 (with a simple `== given_id` expression)
 * into a SliceSelection for the extracted SliceSelect component.
 *
 * This is the inverse of `sliceSelectionToContext`.
 */
export function contextToSliceSelection(
  context: DataExplorerContextV2 | null | undefined
): SliceSelection | null {
  if (!context?.expr) {
    return null;
  }

  if (typeof context.expr !== "object" || !("==" in context.expr)) {
    return null;
  }

  const id = context.expr["=="]?.[1];

  if (!id) {
    return null;
  }

  return { id, label: context.name };
}

/**
 * Converts a raw SliceSelection back into a DataExplorerContextV2 of the form
 * that DimensionSelectV2 expects:
 *
 *   { dimension_type, name, expr: { "==": [{ var: "given_id" }, id] }, vars: {} }
 *
 * This is the inverse of `contextToSliceSelection`.
 */
export function sliceSelectionToContext(
  selection: SliceSelection | null,
  slice_type: string | null | undefined
): DataExplorerContextV2 | null {
  if (!selection) {
    return null;
  }

  // Normalize: when the parent tracks SLICE_TYPE_NULL as `null`, pass `null`
  // through as dimension_type (matching the original toOutputValue behavior).
  const dimension_type = typeof slice_type === "string" ? slice_type : null;

  return {
    dimension_type: dimension_type as string,
    name: selection.label || selection.id,
    expr: { "==": [{ var: "given_id" }, selection.id] },
    vars: {},
  };
}
