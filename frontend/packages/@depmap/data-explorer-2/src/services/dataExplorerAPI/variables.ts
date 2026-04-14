import { breadboxAPI, cached } from "@depmap/api";
import {
  AnnotationType,
  DataExplorerContextVariable,
  SliceQuery,
} from "@depmap/types";
import { compareCaseInsensitive } from "@depmap/utils";
import wellKnownDatasets from "../../constants/wellKnownDatasets";
import { getDimensionDataWithoutLabels } from "./helpers";

export async function fetchVariableDomain(
  variable: DataExplorerContextVariable
) {
  const { dataset_id, identifier, identifier_type } = variable;

  // Build the full SliceQuery, preserving chain info for the data fetch.
  // getDimensionDataWithoutLabels delegates to the chain-aware endpoint when
  // reindex_through is present.
  const sliceQuery: SliceQuery = {
    dataset_id,
    identifier,
    identifier_type,
    ...(variable.reindex_through
      ? { reindex_through: variable.reindex_through }
      : {}),
  };

  let dimension_type: string;
  let value_type: AnnotationType | undefined;
  let references: string | null = null;

  const datasets = await cached(breadboxAPI).getDatasets();
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}"`);
  }

  if (dataset.format === "matrix_dataset") {
    dimension_type = ["feature_id", "feature_label"].includes(identifier_type)
      ? dataset.feature_type_name
      : dataset.sample_type_name;

    value_type = dataset.value_type as AnnotationType;
  } else {
    dimension_type = dataset.index_type_name;

    if (identifier_type !== "column") {
      throw new Error(
        `Can't look up identifier_type "${identifier_type}"` +
          "in a tabular dataset!"
      );
    }

    const column = dataset.columns_metadata[identifier];

    if (!column) {
      throw new Error(
        `Column "${identifier}" not found in dataset "${dataset.id}".`
      );
    }

    value_type = column.col_type;
    references = column.references;
  }

  let data = {
    values: [] as (string | string[] | number | null)[],
  };

  try {
    data = await getDimensionDataWithoutLabels(sliceQuery);

    if (data.values.length === 0) {
      window.console.warn("Slice query returned empty data!", { sliceQuery });
    }
  } catch {
    window.console.error({ sliceQuery });
    throw new Error("Error fetching data from slice query");
  }

  if (value_type === "text" || value_type === "categorical") {
    const stringValues = data.values.filter(
      (val) => typeof val === "string"
    ) as string[];

    return Promise.resolve({
      unique_values: [...new Set(stringValues)].sort(compareCaseInsensitive),
      dimension_type,
      value_type,
      references,
    });
  }

  if (value_type === "continuous") {
    let min = Infinity;
    let max = -Infinity;
    let isAllIntegers = true;
    const distinct = new Set<number>();

    for (let i = 0; i < data.values.length; i += 1) {
      const value = data.values[i];

      if (typeof value === "number") {
        if (value < min) {
          min = value;
        }

        if (value > max) {
          max = value;
        }

        // eslint-disable-next-line no-bitwise
        if (value !== (value | 0)) {
          isAllIntegers = false;
        }

        distinct.add(value);
      }
    }

    const isBinary =
      distinct.size <= 2 && [...distinct].every((n) => n === 0 || n === 1);

    const isBinaryish =
      distinct.size === 3 &&
      distinct.has(0) &&
      distinct.has(1) &&
      distinct.has(2);

    return Promise.resolve({
      min,
      max,
      isBinary,
      isBinaryish,
      isAllIntegers,
      dimension_type,
      value_type,
      references,
    });
  }

  if (value_type === "list_strings") {
    const stringValues = new Set<string>();

    for (let i = 0; i < data.values.length; i += 1) {
      const value = data.values[i];

      if (Array.isArray(value)) {
        value.forEach((s) => stringValues.add(s));
      }
    }

    const unique_values = [...stringValues];

    // HACK: Special case for this one dataset which Katie wants sorted by
    // frequency.
    if (dataset_id === wellKnownDatasets.mutation_protein_change) {
      const freq: Record<string, number> = {};

      for (let i = 0; i < data.values.length; i += 1) {
        const value = data.values[i];

        ((value || []) as string[]).forEach((s) => {
          if (s) {
            freq[s] = (freq[s] || 0) + 1;
          }
        });
      }

      unique_values.sort((a, b) => freq[b] - freq[a]);
    } else {
      unique_values.sort(compareCaseInsensitive);
    }

    return Promise.resolve({
      unique_values,
      dimension_type,
      value_type,
      references,
    });
  }

  throw new Error(`Unsupported value_type "${value_type}".`);
}
