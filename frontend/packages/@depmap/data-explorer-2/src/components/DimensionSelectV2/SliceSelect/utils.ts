import { DataExplorerContextV2 } from "@depmap/types";

export const getIdentifier = (context: DataExplorerContextV2 | null) => {
  if (!context?.expr) {
    return null;
  }

  if (typeof context.expr !== "object") {
    return null;
  }

  return context.expr["=="]?.[1] || null;
};

export function tokenize(input: string | null) {
  const str = input || "";
  const tokens = str.split(/\s+/g).filter(Boolean);
  const uniqueTokens = new Set(tokens);

  return [...uniqueTokens];
}

export const toOutputValue = (
  slice_type: string | null,
  selectedOption?: { label: string; value: string } | null
) => {
  if (!selectedOption) {
    return null;
  }

  const { label, value } = selectedOption;

  return {
    dimension_type: slice_type,
    name: label || value,
    expr: { "==": [{ var: "given_id" }, value] },
    vars: {},
  };
};
