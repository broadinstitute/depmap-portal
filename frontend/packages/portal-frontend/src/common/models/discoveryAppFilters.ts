import memoize from "lodash.memoize";

export type Data = Record<string, any[]>;

export type RangeFilter = {
  kind: "range";
  key: string;
  label: string;
  domain: [number, number];
  step: number;
  value: [number, number];
};

export type NumberInputFilter = {
  kind: "numberInput";
  key: string;
  label: string;
  minOrMax: "min" | "max";
  step: number;
  value: number;
};

export type CheckboxFilter = {
  kind: "checkbox";
  subtype?: string;
  key: string;
  label: string;
  match: number | string | boolean;
  value: boolean;
};

export type MultiSelectFilter = {
  kind: "multiselect";
  key: string;
  label: string;
  options: string[];
  value: string[];
  separator: string | null;
  regex: string | null;
  blocklist: string[] | null;
};

export type Filter =
  | RangeFilter
  | CheckboxFilter
  | MultiSelectFilter
  | NumberInputFilter;

export function isNumberInputFilter(
  filter: Filter
): filter is NumberInputFilter {
  return filter.kind === "numberInput";
}

export function isRangeFilter(filter: Filter): filter is RangeFilter {
  return filter.kind === "range";
}

export function isCheckboxFilter(filter: Filter): filter is CheckboxFilter {
  return filter.kind === "checkbox";
}

export function isMultiSelectFilter(
  filter: Filter
): filter is MultiSelectFilter {
  return filter.kind === "multiselect";
}

const EPSILON = 0.000000001;

function min(values: number[]) {
  let out = Infinity;

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] != null && values[i] < out) {
      out = values[i];
    }
  }

  return out;
}

function max(values: number[]) {
  let out = -Infinity;

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] != null && values[i] > out) {
      out = values[i];
    }
  }

  return out;
}

// This takes a string `option` and resolves it to a list.
//
// If a `separator` is defined, it will be used to split `option`. This makes
// it possible for one entity to belong to more than one category.
// Example: Given option="gastroenterology, endocrinology, oncology" and separator=","
// returns ["gastroenterology", "endocrinology", "oncology"]
//
// If a `regex` is defined, only part of `option` will be considered. The regex
// is executed and only the matching part of the string is retained. This is a
// hacky workaround for creating categories out of values that have additional
// noise.
// Example: Given option="CFI_(3426)_RNAseq" and regex="[^_]+$"
// returns ["RNAseq"]
//
// If a `blocklist` is defined, matching entries will be filtered out of the
// output list.
//
// Note that `separator`, `regex` and `blocklist` are evaluated in that order.
function normalizeMultiselectOption(
  option: string,
  separator: string | null,
  regex: string | null,
  blocklist: string[] | null
): string[] {
  let suboptions =
    separator && typeof option === "string"
      ? option.split(separator).map((s) => s.trim())
      : [option];

  suboptions = regex
    ? suboptions
        .map((suboption) =>
          typeof suboption === "string"
            ? RegExp(regex).exec(suboption)?.[0] || ""
            : suboption
        )
        .filter(Boolean)
    : suboptions;

  suboptions = blocklist
    ? suboptions.filter((x) => !blocklist.includes(x))
    : suboptions;

  return suboptions;
}

// Takes a list of data `values` and boils it down to a list of unique options.
// `separator`, `regex` and `blocklist` allow each value to be processed in
// such a way that it's more suitable to be used as a category (or categories)
// as described above.
function getUniqueMultiselectOptions(
  values: string[],
  separator: string | null,
  regex: string | null,
  blocklist: string[] | null
): string[] {
  const options: Set<string> = new Set();

  values.forEach((value: string) => {
    normalizeMultiselectOption(
      value,
      separator,
      regex,
      blocklist
    ).forEach((option) => options.add(option));
  });

  return [...options].filter((x) => x !== null && x !== undefined).sort();
}

function areFiltersEqual(a: Filter, b: Filter) {
  if (isCheckboxFilter(a) && isCheckboxFilter(b)) {
    return a.value === b.value;
  }

  if (isRangeFilter(a) && isRangeFilter(b)) {
    const [aMin, aMax] = a.value;
    const [bMin, bMax] = b.value;

    return aMin === bMin && aMax === bMax;
  }

  if (isNumberInputFilter(a) && isNumberInputFilter(b)) {
    const aVal = a.value;
    const bVal = b.value;

    return aVal === bVal && a.minOrMax === b.minOrMax && a.step === b.step;
  }

  if (isMultiSelectFilter(a) && isMultiSelectFilter(b)) {
    if (a.value.length !== b.value.length) {
      return false;
    }

    for (let i = 0; i < a.value.length; i += 1) {
      if (a.value[i] !== b.value[i]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

// This takes a set of partial filters (i.e. a set of filters where some may
// not have defined values) and sets defaults where appropriate. The idea is
// that filters can be defined as static JSON and then things like the domain
// of a range filter are computed dynamically based on the data.
export function normalizeFilters(data: Data, partialFilters: any[]): Filter[] {
  return partialFilters.map((filter) => {
    if (typeof filter.key !== "string") {
      throw new Error("filter must have a `key` property");
    }

    if (typeof filter.label !== "string") {
      throw new Error("filter must have a `label` property");
    }

    if (filter.kind === "numberInput") {
      const { kind, key, minOrMax, label } = filter;

      const value = filter.value;
      const step = filter.step ?? 1;

      return { kind, key, label, minOrMax, value, step };
    }

    if (filter.kind === "range") {
      const { kind, key, label } = filter;

      const domain = filter.domain ?? [min(data[key]), max(data[key])];
      const value = (filter.value && filter.value.constructor === Object
        ? [filter.value.min ?? domain[0], filter.value.max ?? domain[1]]
        : filter.value) ?? [domain[0], domain[1]];
      const step = filter.step ?? 0;

      return { kind, key, label, domain, value, step };
    }

    if (filter.kind === "checkbox") {
      const { kind, subtype, key, label, match } = filter;
      const value = filter.value ?? false;

      if (typeof match === "undefined") {
        window.console.warn(
          `Warning: Checkbox filters should have a \`match\` property.`,
          `Check filter with key "${filter.key}".`
        );
      }

      return { kind, subtype, key, label, match, value };
    }

    if (filter.kind === "multiselect") {
      const { kind, key, label } = filter;

      const separator = filter.separator || null;
      const regex = filter.regex || null;
      const blocklist = filter.blocklist || null;

      const options = Array.isArray(filter.options)
        ? filter.options
        : getUniqueMultiselectOptions(data[key], separator, regex, blocklist);

      const value = Array.isArray(filter.value) ? filter.value : [];

      return {
        kind,
        key,
        label,
        options,
        value,
        separator,
        regex,
        blocklist,
      };
    }

    throw new Error(`Unknown filter kind "${(filter as any).kind}"`);
  });
}

// Returns an array of boolean values that represent whether that point should
// be considered in the filtered set or not.
// Note that `memoize` uses the first argument only to generate its cache key.
// As long as filter keys are unique and the data doesn't change over time
// that should be fine. Otherwise, this could behave strangely.
const applyFilter = memoize(
  (filter: Filter, data: Data, length: number): boolean[] => {
    const out = Array(length).fill(false);

    if (!data[filter.key]) {
      window.console.warn(
        `Warning: \`data\` does not have a(n) "${filter.key}" property.`
      );
      return out.fill(true);
    }

    // WORKAROUND: Handle the initial condition where a range filter's values
    // cover its entire domain. In this case, we want to consider the filter to
    // be "off" and not filter anything out. This means that any NaNs or nulls
    // will be preserved. Why would we want to do this? At least in the case of
    // the TDA app, the data are very sparse. Many of the columns are missing
    // values. That means that before the user has even touched the filters, many
    // points could be filtered out -- based on dimensions they may not even care
    // about. This workaround infers they don't care about a dimension based on
    // the fact the slider hasn't been touched yet.
    // Better solutions would be:
    // 1) Ensure all columns (at least the ones used as filters) are fully
    // populated.
    // 2) Provide an explicit way to choose which range filters are active.
    if (
      isRangeFilter(filter) &&
      Math.abs(filter.value[0] - filter.domain[0]) < EPSILON &&
      Math.abs(filter.value[1] - filter.domain[1]) < EPSILON
    ) {
      return out.fill(true);
    }

    for (let i = 0; i < length; i += 1) {
      const dataValue = data[filter.key][i];

      if (isCheckboxFilter(filter)) {
        // `filter.value` is a boolean that controls whether the filter is
        // active. If it is, then the `dataValue` must match the filter's
        // `match` property.
        if (filter.subtype && filter.subtype === "additive") {
          out[i] = filter.value ? true : dataValue === filter.match;
        } else {
          out[i] = filter.value ? dataValue === filter.match : true;
        }
      } else if (isRangeFilter(filter)) {
        if (
          typeof dataValue === "number" &&
          dataValue >= filter.value[0] &&
          dataValue <= filter.value[1]
        ) {
          out[i] = true;
        }
      } else if (isNumberInputFilter(filter)) {
        if (
          typeof dataValue === "number" &&
          ((filter.minOrMax === "min" && dataValue >= filter.value) ||
            (filter.minOrMax === "max" && dataValue <= filter.value))
        ) {
          out[i] = true;
        }
      } else if (isMultiSelectFilter(filter)) {
        out[i] =
          filter.value.length === 0 ||
          normalizeMultiselectOption(
            dataValue,
            filter.separator,
            filter.regex,
            filter.blocklist
          ).some((option: string) => filter.value.indexOf(option) > -1);
      } else {
        window.console.warn(
          `Warning: unknown filter kind "${(filter as any).kind}"`
        );
      }
    }

    return out;
  }
);

// `satisfiesFilters` returns a boolean array where a `false`
//  value means that element should be considered filtered out.
export const satisfiesFilters = memoize(
  (filters: Filter[], data: Data): boolean[] => {
    const firstKey = Object.keys(data)[0];
    const { length } = data[firstKey];
    const out = Array(length).fill(true);

    filters.forEach((filter: Filter) => {
      // Each filter is calculated one-by-one. This makes it possible to memoize
      // them individually and greatly speed up the case where only one has
      // changed. Then we apply each one as a mask (sort of like a bitmask).
      // A false value for any filter drives the overall result false.
      const mask = applyFilter(filter, data, length);

      for (let i = 0; i < length; i += 1) {
        out[i] = out[i] && mask[i];
      }
    });

    return out;
  }
);

// Binds a filter `key` and `value` to a new function that takes an array of
// filters and updates the one with the given key. This makes it convenient to
// use with a React state setter.
export const withUpdatedFilter = (key: string, value: any) => (
  prevFilters: Filter[] | null
) => {
  if (!prevFilters) {
    return null;
  }

  return prevFilters.map((filter: Filter) =>
    key === filter.key ? { ...filter, value } : filter
  );
};

// Returns an array with the keys of any filters that have changed.
export const getChangedFilters = (
  prev?: Filter[] | null,
  next?: Filter[] | null
): string[] => {
  const changes: string[] = [];

  if (!next || !prev) {
    return changes;
  }

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];

    if (!areFiltersEqual(a, b)) {
      changes.push(a.key);
    }
  }

  return changes;
};
