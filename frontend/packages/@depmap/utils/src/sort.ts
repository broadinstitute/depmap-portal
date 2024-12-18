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
