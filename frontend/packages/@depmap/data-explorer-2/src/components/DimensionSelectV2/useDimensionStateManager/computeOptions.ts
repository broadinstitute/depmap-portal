import { breadboxAPI, cached } from "@depmap/api";
import {
  compareCaseInsensitive,
  compareDisabledLast,
  dataTypeSortComparator,
} from "@depmap/utils";
import { DimensionType } from "@depmap/types";
import { pluralize, sortDimensionTypes } from "../../../utils/misc";
import { State, SLICE_TYPE_NULL } from "./types";
import {
  DataExplorerDatasetDescriptor,
  fetchDatasetsByIndexType,
} from "./utils";

function formatList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(" and ");
  return items.slice(0, -1).join(", ") + ", and " + items.at(-1);
}

async function fetchIndexCompatibleDatasets(
  index_type: string | null,
  selectedDatasetId: string | null,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  allowNullFeatureType: boolean
) {
  if (!index_type) {
    return [];
  }

  const datasets = await fetchDatasetsByIndexType(
    index_type,
    selectedDatasetId
  );

  if (datasets.length === 0) {
    throw new Error(`Unknown or unpopulated dimension type "${index_type}".`);
  }

  return datasets.filter((d) => {
    if (!allowNullFeatureType && d.slice_type === SLICE_TYPE_NULL) {
      return false;
    }

    return valueTypes.has(
      d.value_type as typeof valueTypes extends Set<infer U> ? U : never
    );
  });
}

// Every matrix dataset of this slice_type, before anything is asked about what
// the context contains. The candidate list.
async function fetchSliceTypeDatasets(dimension: State["dimension"]) {
  if (dimension.slice_type === undefined) {
    return cached(breadboxAPI).getDatasets();
  }

  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const axis = dimensionTypes.find((dt) => dt.name === dimension.slice_type)
    ?.axis;

  const prop = axis === "sample" ? "sample_type_name" : "feature_type_name";

  return cached(breadboxAPI)
    .getDatasets()
    .then((datasets) =>
      datasets.filter(
        (d) => d.format === "matrix_dataset" && d[prop] === dimension.slice_type
      )
    );
}

// How many of the context's entities each dataset actually contains, or null
// when there is no context to ask about.
//
// This replaced a block that read the context's expression directly — looking
// for `"=="`, then guessing a query param from the variable name — which only
// ever worked for one shape. A multi-feature context (`aggregated_slice`)
// skipped the check entirely, so the Data Version select ranked purely by
// priority and routinely resolved to a dataset containing none of the
// entities. Less visibly, the label-based branches built query params Breadbox
// does not accept, and FastAPI ignores unknown params silently, so those
// degraded to unfiltered too. One endpoint answers the question for every
// context shape, so none of that parsing is needed.
//
// Failure returns null rather than an empty result: no opinion leaves the
// options exactly as they were before this existed, where an empty one would
// disable every dataset and strand the user.
async function fetchContextCoverage(dimension: State["dimension"]) {
  if (!dimension.context || !dimension.slice_type) {
    return null;
  }

  try {
    // wholeCatalog, not persist: true — the response spans every dataset the
    // caller can see, so the engine persists it only for callers whose whole
    // catalog is public (keyed by a fingerprint of the listing) and keeps it
    // in-memory-only for anyone who can see a private dataset. See ADR 0008.
    const coverage = await cached(breadboxAPI, {
      persist: { wholeCatalog: true },
    }).getContextDatasetCoverage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dimension.context as any
    );

    // A zero total means either the context resolved to nothing or the request
    // failed — getContextDatasetCoverage answers a failure with an empty result
    // rather than throwing, so the catch below never sees one. Both cases mean
    // the same thing here, and it isn't "every dataset covers none of it": that
    // reading disables every data version and strands the user.
    return coverage.total > 0 ? coverage : null;
  } catch (e) {
    window.console.warn("Could not determine dataset coverage", e);
    return null;
  }
}

async function fetchContextCompatibleDatasets(dimension: State["dimension"]) {
  const datasets = await fetchSliceTypeDatasets(dimension);
  const coverage = await fetchContextCoverage(dimension);

  if (!coverage) {
    return datasets;
  }

  return datasets.filter((d) => (coverage.counts[d.id] ?? 0) > 0);
}

async function fetchContextCompatibleDataTypes(dimension: State["dimension"]) {
  const datasets = await fetchContextCompatibleDatasets(dimension);

  if (!datasets) {
    return null;
  }

  const dataTypes = new Set<string>();

  datasets.forEach((d) => {
    dataTypes.add(d.data_type);
  });

  return dataTypes;
}

async function computeDataTypeOptions(
  index_type: string | null,
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[]
) {
  const contextCompatibleDataTypes = await fetchContextCompatibleDataTypes(
    dimension
  );

  const dataTypes = [...new Set(datasets.map((d) => d.data_type))].sort(
    compareCaseInsensitive
  );

  const sliceAxis =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)?.axis ||
    "sample";

  let sliceDisplayName =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)
      ?.display_name || dimension.slice_type;

  if (!sliceDisplayName) {
    sliceDisplayName = sliceAxis;
  }

  if (dimension.slice_type === null && dimension.dataset_id) {
    const selectedDataType = datasets.find(
      (d) =>
        d.id === dimension.dataset_id || d.given_id === dimension.dataset_id
    )?.data_type;

    const options = dataTypes.map((dataType) => {
      let isDisabled = false;
      let disabledReason = "";

      if (dataType !== selectedDataType) {
        isDisabled = true;
        disabledReason = "Clear the Data Version to use this type.";
      }

      return {
        label: dataType,
        value: dataType,
        isDisabled,
        disabledReason,
      };
    });

    return options
      .sort((a, b) => dataTypeSortComparator(a.value, b.value))
      .sort(compareDisabledLast);
  }

  const options = dataTypes.map((dataType) => {
    let isDisabled = false;
    let disabledReason = "";

    const isCompatibleWithSliceType =
      !dimension.slice_type ||
      datasets.find((dataset) => {
        return (
          dataset.data_type === dataType &&
          dataset.slice_type === dimension.slice_type
        );
      }) !== undefined;

    if (!isCompatibleWithSliceType) {
      isDisabled = true;

      disabledReason = [
        "The",
        `${sliceAxis} type`,
        `“${sliceDisplayName}”`,
        "is incompatible with this data type",
      ].join(" ");
    } else if (
      dimension.slice_type !== null &&
      contextCompatibleDataTypes &&
      !contextCompatibleDataTypes.has(dataType)
    ) {
      isDisabled = true;

      const dimensionLabel = dimension.context?.name;

      if (dimension.axis_type === "aggregated_slice") {
        disabledReason = [
          `The context “${dimensionLabel}”`,
          `has no ${pluralize(
            sliceDisplayName as string
          )} associated with this type`,
        ].join(" ");
      } else {
        disabledReason = [
          `The ${sliceDisplayName} “${dimensionLabel}”`,
          "is not found in any data versions associated with this type",
        ].join(" ");
      }
    }

    return {
      label: dataType,
      value: dataType,
      isDisabled,
      disabledReason,
    };
  });

  return options
    .sort((a, b) => dataTypeSortComparator(a.value, b.value))
    .sort(compareDisabledLast);
}

async function computeSliceTypeOptions(
  index_type: string | null,
  selectedDataType: string | null,
  selectedUnits: string | null,
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[]
) {
  const sliceTypeOptions: State["sliceTypeOptions"] = [];
  const seen = new Set<string>();

  const sliceAxis =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)?.axis ||
    "sample";

  datasets.forEach((dataset) => {
    if (dataset.slice_type === SLICE_TYPE_NULL) {
      return;
    }

    if (seen.has(dataset.slice_type as string)) {
      return;
    }

    seen.add(dataset.slice_type as string);

    const label =
      dimensionTypes.find((d) => d.name === dataset.slice_type)?.display_name ||
      dataset.slice_type.toString();

    let isDisabled = false;
    let disabledReason = "";

    const isCompatibleWithDataType =
      !selectedDataType ||
      datasets.find(
        (d) =>
          d.data_type === selectedDataType &&
          d.slice_type === dataset.slice_type
      ) !== undefined;

    if (!isCompatibleWithDataType) {
      isDisabled = true;

      disabledReason = [
        "The data type",
        `“${selectedDataType}”`,
        "is incompatible with this",
        `${sliceAxis} type`,
      ].join(" ");
    }

    sliceTypeOptions.push({
      label,
      value: dataset.slice_type,
      isDisabled,
      disabledReason,
    });
  });

  if (
    datasets.some(
      (d) =>
        (!selectedDataType || selectedDataType === d.data_type) &&
        d.slice_type === SLICE_TYPE_NULL
    )
  ) {
    sliceTypeOptions.unshift({
      label: SLICE_TYPE_NULL.toString(),
      value: SLICE_TYPE_NULL,
      isDisabled: false,
      disabledReason: "",
    });
  }

  return sliceTypeOptions.sort((a, b) => {
    if (a.isDisabled && !b.isDisabled) {
      return 1;
    }

    if (!a.isDisabled && b.isDisabled) {
      return -1;
    }

    const [sorted] = sortDimensionTypes([
      a.value.toString(),
      b.value.toString(),
    ]);

    return sorted === a.value ? -1 : 1;
  });
}

// The fewest entities a data version must hold before it counts as able to
// answer the question at all. Below this, `priority` doesn't get a say.
//
// 0 is useless and 1 nearly so — aggregation and faceting both presuppose a
// collection. 2 is where those operations become defined but degenerate (a
// correlation over two points is always exactly ±1), so 3 is the first count
// that yields a non-degenerate answer.
const MIN_USEFUL_COVERAGE = 3;

// Which data version gets offered first. `priority` decides among the versions
// that can actually answer the question; coverage only decides which of the
// versions that can't is least bad.
//
// This is a deliberate step back from ranking purely by coverage, which let any
// coverage difference at all — 380 entities vs. 379 — override the curated
// `priority` order, and drew complaints that priority was being ignored. It is
// also a step forward from ranking purely by `priority`, which on sparse data
// resolved the default to versions containing not a single one of the entities.
//
// The floor is clamped to the size of the context: a context of two entities
// can never clear a floor of three, and leaving it permanently below the floor
// would quietly restore coverage-first ordering for the single-entity and
// small-context cases that are the most common of all.
//
// With no context to measure against, `total` is null, the floor is zero, every
// version clears it, and this collapses to the priority ordering.
export function compareByPriorityAboveCoverageFloor<
  T extends { priority?: number | null }
>(coverageOf: (dataset: T) => number, total: number | null) {
  const floor = total === null ? 0 : Math.min(MIN_USEFUL_COVERAGE, total);

  return (a: T, b: T) => {
    const aCoverage = coverageOf(a);
    const bCoverage = coverageOf(b);
    const aClearsFloor = aCoverage >= floor;
    const bClearsFloor = bCoverage >= floor;

    if (aClearsFloor !== bClearsFloor) {
      return aClearsFloor ? -1 : 1;
    }

    // Only below the floor does coverage outrank priority: nothing here can
    // really answer the question, so offer whichever comes closest.
    if (!aClearsFloor && bCoverage !== aCoverage) {
      return bCoverage - aCoverage;
    }

    // Unprioritized last: `1` is the highest priority, so a missing one is an
    // absence of curation rather than the strongest possible claim. This is
    // also the convention everywhere else — the compound page, the gene page,
    // and `sortByNumberOrNull` in @depmap/utils all sink nulls.
    //
    // Compared rather than subtracted because subtracting two sentinels is
    // NaN, which the sort silently reads as "equal".
    const aPriority = a.priority ?? Infinity;
    const bPriority = b.priority ?? Infinity;

    if (aPriority !== bPriority) {
      return aPriority < bPriority ? -1 : 1;
    }

    // Coverage settles what priority can't. This is what makes a list where
    // nothing is prioritized rank by coverage alone: every pair ties above, so
    // this line decides all of them. Without it such a list would keep whatever
    // order the dataset request happened to return.
    return bCoverage - aCoverage;
  };
}

async function computeDataVersionOptions(
  index_type: string | null,
  selectedDataType: string | null,
  selectedUnits: string | null,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  dimension: State["dimension"],
  datasets: DataExplorerDatasetDescriptor[],
  dimensionTypes: DimensionType[],
  hiddenDatasets: Set<string>
) {
  const coverage = await fetchContextCoverage(dimension);

  const sliceAxis =
    dimensionTypes.find((dt) => dt.name === dimension.slice_type)?.axis ||
    "sample";

  let foundDefault = false;

  const coverageOf = (d: DataExplorerDatasetDescriptor) =>
    coverage ? coverage.counts[d.id] ?? 0 : 0;

  // Keyed by the same thing the option's `value` is, so the re-sort after
  // mapping can find it. Keying by `id` alone silently produced NaN for every
  // dataset with a given_id, which made that sort a no-op.
  const rank: Record<string, number> = {};

  return datasets
    .filter((d) => !selectedDataType || d.data_type === selectedDataType)
    .filter(
      (d) =>
        !hiddenDatasets.has(d.id) &&
        (!d.given_id || !hiddenDatasets.has(d.given_id))
    )
    .filter((d) =>
      valueTypes.has(
        d.value_type as typeof valueTypes extends Set<infer U> ? U : never
      )
    )
    .sort(
      compareByPriorityAboveCoverageFloor(coverageOf, coverage?.total ?? null)
    )
    .map((dataset, index) => {
      rank[dataset.given_id || dataset.id] = index;

      let isDisabled = false;
      let disabledReason = "";

      const sliceDisplayName = dataset.slice_type_display_name;

      if (selectedUnits && selectedUnits !== dataset.units) {
        isDisabled = true;
        disabledReason = [
          "This version is only compatible with the measure",
          `“${dataset.units}”`,
        ].join(" ");
      }

      if (
        dimension.axis_type === "aggregated_slice" &&
        dataset.value_type !== "continuous"
      ) {
        isDisabled = true;
        disabledReason = [
          "You can't aggregate over this dataset because ",
          "its values are not numerical.",
        ].join("");
      }

      if (
        dimension.dataset_id &&
        dimension.slice_type === null &&
        dataset.slice_type.valueOf() === null
      ) {
        if (
          dimension.context &&
          dimension.dataset_id !== dataset.id &&
          dimension.dataset_id !== dataset.given_id
        ) {
          isDisabled = true;
          disabledReason = [
            "Clear the feature in order to use this version (its features ",
            "are not compatible because they are specific to the data version ",
            "itself).",
          ].join("");
        }
      } else if (
        dataset.slice_type.valueOf() === null &&
        dimension.axis_type === "aggregated_slice"
      ) {
        isDisabled = true;
        disabledReason = [
          "This version cannot be used because a context ",
          "can’t be created from the generic features in it.",
        ].join("");
      } else if (
        dimension.slice_type !== undefined &&
        dataset.slice_type.valueOf() !== dimension.slice_type
      ) {
        isDisabled = true;

        disabledReason = dataset.slice_type.valueOf()
          ? [
              "This version is only compatible with",
              sliceAxis,
              `type “${sliceDisplayName}”`,
            ].join(" ")
          : [
              "Clear the Feature Type in order to use this version",
              "(it uses generic features that don’t have a type).",
            ].join(" ");
      } else if (coverage && coverageOf(dataset) === 0) {
        isDisabled = true;
        const name = dimension.context?.name || "unknonwn";

        if (dimension.axis_type === "aggregated_slice") {
          disabledReason = [
            `The context “${name}”`,
            `has no ${pluralize(sliceDisplayName as string)}`,
            "found in this version",
          ].join(" ");
        } else {
          disabledReason = [
            `The ${sliceDisplayName} “${name}”`,
            "is not found in this version",
          ].join(" ");
        }
      }

      let isDefault = false;

      if (!foundDefault && !isDisabled) {
        foundDefault = true;
        isDefault = true;
      }

      return {
        label: dataset.name,
        value: dataset.given_id || dataset.id,
        isDisabled,
        disabledReason,
        isDefault,
        // How much of the context this version actually has, for the select to
        // show. Undefined when there is no context to measure against, which
        // is different from covering none of it.
        matched: coverage ? coverageOf(dataset) : undefined,
        total: coverage ? coverage.total : undefined,
      };
    })
    .sort((a, b) => rank[a.value] - rank[b.value])
    .sort(compareDisabledLast);
}

export async function computeUnitsOptions(
  index_type: string | null,
  selectedDataType: string | null,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  allowNullFeatureType: boolean,
  dimension: State["dimension"]
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(
      index_type,
      dimension.dataset_id || null,
      valueTypes,
      allowNullFeatureType
    ),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const compatSliceTypes: Record<string, Set<string | null>> = {};

  for (const d of datasets) {
    compatSliceTypes[d.units] ||= new Set<string | null>();
    compatSliceTypes[d.units].add(d.slice_type.valueOf());
  }

  const sliceAxis =
    dimension.slice_type === null
      ? "feature"
      : dimensionTypes.find((dt) => dt.name === dimension.slice_type)?.axis ||
        "sample";

  const unitsOptions = [
    ...new Set(
      datasets
        .filter((d) => {
          if (!d.units) {
            return false;
          }

          return !selectedDataType || d.data_type === selectedDataType;
        })
        .map((d) => d.units)
    ),
  ]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((units) => {
      let isDisabled = false;
      let disabledReason = "";

      if (
        dimension.slice_type !== undefined &&
        !compatSliceTypes[units]?.has(dimension.slice_type)
      ) {
        isDisabled = true;

        const sliceTypes = [...compatSliceTypes[units]]
          .filter(Boolean)
          .map((dimensionTypeName) => {
            return (
              dimensionTypes.find((dt) => dt.name === dimensionTypeName)
                ?.display_name || dimensionTypeName
            );
          });

        disabledReason =
          sliceTypes.length > 0
            ? [
                "This measure is only compatible with",
                sliceAxis,
                sliceTypes.length === 1 ? "type" : "types",
                formatList(sliceTypes.map((t) => `“${t}”`)),
              ].join(" ")
            : `Clear the ${sliceAxis} type to use this measure`;
      }

      return {
        label: units,
        value: units,
        isDisabled,
        disabledReason,
      };
    });

  return unitsOptions;
}

export default async function computeOptions(
  index_type: string | null,
  selectedDataType: string | null,
  selectedUnits: string | null,
  allowNullFeatureType: boolean,
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">,
  hiddenDatasets: Set<string>,
  dimension: State["dimension"]
) {
  const [datasets, dimensionTypes] = await Promise.all([
    fetchIndexCompatibleDatasets(
      index_type,
      dimension.dataset_id || null,
      valueTypes,
      allowNullFeatureType
    ),
    cached(breadboxAPI).getDimensionTypes(),
  ]);

  const [
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    unitsOptions,
  ] = await Promise.all([
    computeDataTypeOptions(index_type, dimension, datasets, dimensionTypes),
    computeSliceTypeOptions(
      index_type,
      selectedDataType,
      selectedUnits,
      dimension,
      datasets,
      dimensionTypes
    ),
    computeDataVersionOptions(
      index_type,
      selectedDataType,
      selectedUnits,
      valueTypes,
      dimension,
      datasets,
      dimensionTypes,
      hiddenDatasets
    ),
    computeUnitsOptions(
      index_type,
      selectedDataType,
      valueTypes,
      allowNullFeatureType,
      dimension
    ),
  ]);

  return {
    dataTypeOptions,
    sliceTypeOptions,
    dataVersionOptions,
    unitsOptions,
  };
}
