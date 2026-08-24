type SortOrder = "asc" | "desc";

const collator = new Intl.Collator("en", { sensitivity: "base" });

export const compareCaseInsensitive = collator.compare;

// Numbers, including their decimal part, so they can be compared as numbers.
// Everything between them is text.
const NUMBER = /(\d+(?:\.\d+)?)/;

// Orders labels the way a reader expects when they contain numbers: "Sample 2"
// before "Sample 10", and 0.01 uM before 0.1 uM.
//
// Written rather than configured because `Intl.Collator`'s own `numeric: true`
// cannot do the second one. It compares runs of DIGITS as integers, and a
// decimal point ends a run — so "0.0100052…" and "0.100035…" compare as
// 100052698506632 against 100035129252774, which are nearly equal, and a dose
// series interleaves itself at every power of ten. The magnitude lives entirely
// in the leading zeros, which that comparison discards.
//
// Deliberately unsigned, matching Intl: treating "-" as a minus sign would put
// "A-2" before "A-1". Scientific notation is likewise left as text.
//
// This orders *labels*. When a number's meaning depends on something else in
// the string — a unit, say — only that other thing is authoritative: "10 nM"
// sorts after "2 uM" here, correctly by the number and wrongly by the dose.
export const compareNaturally = (a: string, b: string) => {
  // String.split with one capture group alternates text, number, text, number…
  // so the odd indices are exactly the captured numbers.
  const segmentsA = String(a).split(NUMBER);
  const segmentsB = String(b).split(NUMBER);
  const shared = Math.min(segmentsA.length, segmentsB.length);

  for (let i = 0; i < shared; i += 1) {
    if (i % 2 === 1) {
      const difference = Number(segmentsA[i]) - Number(segmentsB[i]);

      if (difference !== 0) {
        return difference < 0 ? -1 : 1;
      }
    } else {
      const difference = collator.compare(segmentsA[i], segmentsB[i]);

      if (difference !== 0) {
        return difference;
      }
    }
  }

  // Identical as far as the shorter one goes, so the shorter sorts first.
  return segmentsA.length - segmentsB.length;
};

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
