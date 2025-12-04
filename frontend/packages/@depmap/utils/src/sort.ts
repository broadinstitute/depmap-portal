type SortOrder = "asc" | "desc";

const collator = new Intl.Collator("en", { sensitivity: "base" });

export const compareCaseInsensitive = collator.compare;

export const compareDisabledLast = (
  a: { isDisabled: boolean },
  b: { isDisabled: boolean }
) => {
  if (a.isDisabled && !b.isDisabled) {
    return 1;
  }

  if (!a.isDisabled && b.isDisabled) {
    return -1;
  }

  return 0;
};

export function sortByNumberOrNull<T>(
  arr: T[],
  property: keyof T,
  order: SortOrder = "asc"
): T[] {
  return [...arr].sort((a, b) => {
    const valA = a[property] as number | null;
    const valB = b[property] as number | null;

    // Handle null values: nulls always go to the end
    if (valA === null && valB !== null) {
      return 1;
    }
    if (valA !== null && valB === null) {
      return -1;
    }
    if (valA === null && valB === null) {
      return 0; // Both are null, maintain relative order
    }

    // Both are numbers, perform numeric comparison
    if (order === "asc") {
      return (valA as number) - (valB as number);
    }
    return (valB as number) - (valA as number);
  });
}

const dataTypePriorityOrder = [
  "CRISPR",
  "RNAi",
  "CN",
  "Expression",
  "Gene accessibility",
  "Methylation",
  "Mutations",
  "Drug screen",
  "Combo Drug screen",
];

const bottomPriorityOrder = ["Annotations", "Deprecated"];

export const dataTypeSortComparator = (a: string, b: string) => {
  const aBottom = bottomPriorityOrder.indexOf(a);
  const bBottom = bottomPriorityOrder.indexOf(b);

  // If both are in bottom priority list, sort by their order in that list
  if (aBottom !== -1 && bBottom !== -1) {
    return aBottom - bBottom;
  }

  // If only one is in bottom priority list, it goes after the other
  if (aBottom !== -1) return 1;
  if (bBottom !== -1) return -1;

  // Neither are in bottom list, proceed with normal logic
  const ai = dataTypePriorityOrder.indexOf(a);
  const bi = dataTypePriorityOrder.indexOf(b);

  if (ai !== -1 && bi !== -1) {
    // both are in priority list — sort by their order in that list
    return ai - bi;
  }
  if (ai !== -1) return -1; // a is priority, b is not
  if (bi !== -1) return 1; // b is priority, a is not

  // neither are priority — sort alphabetically
  return compareCaseInsensitive(a, b);
};
