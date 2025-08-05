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

export const getSortProp = <T>(key: keyof T) => {
  return (compare: (x: string, y: string) => number) => {
    return (a: T, b: T): number => compare(String(a[key]), String(b[key]));
  };
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
