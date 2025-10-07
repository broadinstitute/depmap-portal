import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "plotly.js";
import {
  DataExplorerMetadata,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  SliceQuery,
} from "@depmap/types";
import wellKnownDatasets from "../../../../../constants/wellKnownDatasets";

// HACK: Copied from the "depmap-shared" directory.
const colorPalette = {
  damaging_color: "#F4220C",
  gene_color: "#AAAAAA",
  hotspot_color: "#F4840C",
  other_conserving_color: "#2497AA",
  other_non_conserving_color: "#076075",
};

export interface DataExplorerColorPalette {
  all: string;
  other: string;
  compare1: string;
  compare2: string;
  compareBoth: string;
  qualitativeFew: string[];
  qualitativeMany: string[];
  sequentialScale: string[][];
}

export type RegressionLine = {
  b: number;
  color: string;
  hidden: boolean;
  m: number;
};

export const LEGEND_ALL = Symbol("All");
export const LEGEND_BOTH = Symbol("Both");
export const LEGEND_OTHER = Symbol("Other");
export const LEGEND_RANGE_1 = Symbol("Range 1");
export const LEGEND_RANGE_2 = Symbol("Range 2");
export const LEGEND_RANGE_3 = Symbol("Range 3");
export const LEGEND_RANGE_4 = Symbol("Range 4");
export const LEGEND_RANGE_5 = Symbol("Range 5");
export const LEGEND_RANGE_6 = Symbol("Range 6");
export const LEGEND_RANGE_7 = Symbol("Range 7");
export const LEGEND_RANGE_8 = Symbol("Range 8");
export const LEGEND_RANGE_9 = Symbol("Range 9");
export const LEGEND_RANGE_10 = Symbol("Range 10");

export type LegendKey =
  | typeof LEGEND_ALL
  | typeof LEGEND_BOTH
  | typeof LEGEND_OTHER
  | typeof LEGEND_RANGE_1
  | typeof LEGEND_RANGE_2
  | typeof LEGEND_RANGE_3
  | typeof LEGEND_RANGE_4
  | typeof LEGEND_RANGE_5
  | typeof LEGEND_RANGE_6
  | typeof LEGEND_RANGE_7
  | typeof LEGEND_RANGE_8
  | typeof LEGEND_RANGE_9
  | typeof LEGEND_RANGE_10
  | string;

const d3_category10 = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

const d3_category20 = [
  "#1f77b4",
  "#aec7e8",
  "#ff7f0e",
  "#ffbb78",
  "#2ca02c",
  "#98df8a",
  "#d62728",
  "#ff9896",
  "#9467bd",
  "#c5b0d5",
  "#8c564b",
  "#c49c94",
  "#e377c2",
  "#f7b6d2",
  "#7f7f7f",
  "#c7c7c7",
  "#bcbd22",
  "#dbdb8d",
  "#17becf",
  "#9edae5",
];

export const DEFAULT_PALETTE = {
  all: colorPalette.gene_color,
  other: colorPalette.gene_color,
  compare1: "#1A7DB6",
  compare2: "#F1DC6C",
  compareBoth: "#77BE86",
  qualitativeFew: d3_category10,
  qualitativeMany: d3_category20,
  sequentialScale: [
    ["0.0", "#FFFED8"],
    ["0.111111", "#EFF6BB"],
    ["0.222222", "#D4E9B0"],
    ["0.333333", "#A7D5B1"],
    ["0.444444", "#76BFB5"],
    ["0.555555", "#50A8B8"],
    ["0.666666", "#388BB3"],
    ["0.777777", "#2968A4"],
    ["0.888888", "#192E75"],
    ["1.0", "#0B1D4B"],
  ],
};

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const compareLegendKeys = (keyA: symbol | string, keyB: symbol | string) => {
  if (typeof keyA === "symbol") {
    return 1;
  }

  if (typeof keyB === "symbol") {
    return -1;
  }

  return collator.compare(keyA, keyB);
};

export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hex
    .replace(/^#/, "")
    .replace(/(.)/g, hex.length < 6 ? "$1$1" : "$1")
    .match(/../g)!
    .map((word) => parseInt(word, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function nullifyUnplottableValues(
  values?: number[],
  visibleFilter?: boolean[],
  dependentDimensions?: { values: unknown[] }[]
) {
  if (!values) {
    return null;
  }

  const out = [];

  for (let i = 0; i < values.length; i += 1) {
    let value: number | null = values[i];

    if (visibleFilter?.[i] === false) {
      value = null;
    }

    if (dependentDimensions) {
      for (let j = 0; j < dependentDimensions.length; j += 1) {
        if (dependentDimensions[j]?.values[i] === null) {
          value = null;
        }
      }
    }

    out.push(value);
  }

  return out;
}

export function findCategoricalSlice(data: DataExplorerPlotResponse | null) {
  if (!data) {
    return null;
  }

  const colorDim = data.dimensions?.color;

  if (colorDim && colorDim.value_type === "categorical") {
    return {
      label: colorDim.axis_label,
      dataset_id: colorDim.dataset_id,
      values: colorDim.values,
      value_type: colorDim.value_type,
    };
  }

  return data?.metadata?.color_property || null;
}

export function findContinuousColorSlice(
  data: DataExplorerPlotResponse | null
) {
  const colorDim = data?.dimensions?.color;

  if (colorDim?.value_type === "continuous") {
    return {
      label: colorDim.axis_label,
      values: colorDim.values,
      value_type: colorDim.value_type,
    };
  }

  return null;
}

export function formatDataForScatterPlot(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"]
) {
  if (!data) {
    return null;
  }

  const round = (num: number) =>
    Math.round((num + Number.EPSILON) * 1.0e7) / 1.0e7;

  const c1Values = data.filters?.color1?.values;
  const c2Values = data.filters?.color2?.values;
  const catValues = findCategoricalSlice(data)?.values;
  const contSlice = findContinuousColorSlice(data);
  const contValues = nullifyUnplottableValues(
    contSlice?.values,
    data.filters?.visible?.values,
    [data.dimensions.x, data.dimensions.y!]
  );

  let xLabel = [data.dimensions.x.axis_label, data.dimensions.x.dataset_label]
    .filter(Boolean)
    .join("<br>");

  let yLabel: string | null = null;

  if (data.dimensions.y) {
    yLabel = [data.dimensions.y.axis_label, data.dimensions.y.dataset_label]
      .filter(Boolean)
      .join("<br>");
  }

  if (data.filters.visible) {
    if (xLabel) {
      xLabel += `<br>filtered by ${data.filters.visible.name}`;
    } else {
      yLabel += `<br>filtered by ${data.filters.visible.name}`;
    }
  }

  return {
    xLabel,
    yLabel,

    x: nullifyUnplottableValues(
      data.dimensions.x.values,
      data.filters?.visible?.values
    ),

    y: nullifyUnplottableValues(
      data.dimensions?.y?.values,
      data.filters?.visible?.values
    ),

    color1: c1Values || null,
    color2: c2Values || null,
    catColorData: catValues || null,
    contColorData: contValues || null,

    hoverText: data.index_labels.map((label: string, i: number) => {
      const aliases: string[] = [];
      const colorInfo = [];

      // FIXME: We shouldn't have a special case for models.
      // We should just show both id and label.
      if (data.index_type === "depmap_model") {
        aliases.push(`<b>${data.index_display_labels[i]}</b>`);
      }

      if (c1Values && c1Values[i] && color_by === "aggregated_slice") {
        colorInfo.push(data.filters.color1!.name);
      }

      if (c2Values && c2Values[i] && color_by === "aggregated_slice") {
        colorInfo.push(data.filters.color2!.name);
      }

      if (contValues && contValues[i] !== null) {
        colorInfo.push(
          [
            `<b>${data.dimensions.color!.axis_label}</b>`,
            round(contValues[i] as number),
          ].join(": ")
        );
      }

      const formattedLabel =
        data.index_type === "compound_experiment"
          ? label.replace(/\s+\(BRD:.*\)/, "")
          : label;

      const formattedLines =
        aliases.length > 0
          ? [...aliases, `${formattedLabel}`, ...colorInfo]
          : [`<b>${formattedLabel}</b>`, ...colorInfo];

      Object.keys(data.metadata || {}).forEach((key) => {
        const { label: hoverLabel, values, value_type } = data.metadata[key]!;

        const nullValueLabel =
          value_type === "categorical" ? "<b>N/A</b>" : "Other";
        let val = values[i] != null ? values[i].toString() : nullValueLabel;
        val = val.length > 40 ? `${val.substr(0, 40)}…` : val;

        formattedLines.push(`${hoverLabel}: ${val}`);
      });

      return formattedLines.join("<br>");
    }),

    annotationText: data.index_labels.map((label: string, i: number) => {
      const aliases: string[] = [];

      // FIXME: We shouldn't have a special case for models.
      // We should just show both id and label.
      if (data.index_type === "depmap_model") {
        aliases.push(`<b>${data.index_display_labels[i]}</b>`);
      }

      const formattedLabel =
        data.index_type === "compound_experiment"
          ? label.replace(/\s+\(BRD:.*\)/, "")
          : label;

      return aliases.length > 0
        ? [...aliases].join("<br>")
        : `<b>${formattedLabel}</b>`;
    }),
  };
}

export function formatDataForWaterfall(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"],
  sortedLegendKeys?: (string | symbol)[]
) {
  if (!data) {
    return null;
  }

  const formatted = formatDataForScatterPlot(data, color_by);

  if (!formatted || !sortedLegendKeys) {
    return formatted;
  }

  // If the legend keys have been sorted, then we have to move around the x
  // values to match.
  let j = 0;
  const x: number[] = [];
  const catData = formatted.catColorData as string[];
  const visible = data.filters?.visible?.values;
  const domain = visible ? visible.filter(Boolean).length : catData.length;
  const minLength = domain / sortedLegendKeys.length;
  const groups: Record<string | symbol, { start: number; length: number }> = {};

  for (let i = 0; i < catData.length; i += 1) {
    const category = catData[i] || LEGEND_OTHER;
    groups[category] ||= { start: i, length: 0 };
    groups[category].length++;
  }

  sortedLegendKeys.forEach((key) => {
    const { start, length } = groups[key];

    if (length < minLength && j > 0) {
      j += Math.floor(minLength - length / 2);
    }

    for (let i = start; i < start + length; i += 1) {
      if (!visible || visible[i]) {
        x[i] = j;
        j++;
      }
    }

    if (length < minLength) {
      j += Math.floor(minLength - length / 2);
    }
  });

  return { ...formatted, x };
}

function colorMetadataChanged(
  ma?: DataExplorerMetadata,
  mb?: DataExplorerMetadata
) {
  const a = ma?.color_property;
  const b = mb?.color_property;

  if (!a && !b) {
    return false;
  }

  if (!a) {
    return true;
  }

  if (!b) {
    return true;
  }

  if ("slice_id" in a && "slice_id" in b) {
    return a.slice_id !== b.slice_id;
  }

  const sqA = a as SliceQuery;
  const sqB = b as SliceQuery;

  return (
    sqA.dataset_id !== sqB.dataset_id ||
    sqA.identifier !== sqB.identifier ||
    sqA.identifier_type !== sqB.identifier_type
  );
}

export function useLegendState(
  plotConfig: DataExplorerPlotConfig,
  legendKeysWithNoData?: any
) {
  const prevPlotConfig = useRef(plotConfig);
  const recentClickKey = useRef<string | symbol | null>(null);
  const recentClickMap = useRef<Record<string, string> | null>(null);
  const [hiddenLegendValues, setHiddenLegendValues] = useState(() => new Set());

  useEffect(() => {
    let hasChanges = false;

    if (
      colorMetadataChanged(prevPlotConfig.current.metadata, plotConfig.metadata)
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.color1?.name !==
      plotConfig.filters?.color1?.name
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.color2?.name !==
      plotConfig.filters?.color2?.name
    ) {
      hasChanges = true;
    }

    if (
      Boolean(prevPlotConfig.current.dimensions.color?.context) !==
      Boolean(plotConfig.dimensions.color?.context)
    ) {
      hasChanges = true;
    }

    if (hasChanges) {
      setHiddenLegendValues(new Set());
    }

    prevPlotConfig.current = plotConfig;
  }, [plotConfig]);

  useEffect(() => {
    if (legendKeysWithNoData) {
      setHiddenLegendValues(legendKeysWithNoData);
    } else {
      setHiddenLegendValues(new Set());
    }
  }, [legendKeysWithNoData]);

  const onClickLegendItem = useCallback(
    (key: string | symbol, catColorMap: Record<string, string>) => {
      if (recentClickKey.current === key) {
        setHiddenLegendValues((prev) => {
          const allKeys = new Set(
            Reflect.ownKeys(recentClickMap.current as object)
          );

          if (prev.has(key) && prev.size !== allKeys.size) {
            const next = new Set(allKeys);
            next.delete(key);
            return next;
          }

          return new Set();
        });

        return;
      }

      recentClickKey.current = key;
      recentClickMap.current = catColorMap;

      setTimeout(() => {
        recentClickKey.current = null;
      }, 300);

      setHiddenLegendValues((prev) => {
        const next = new Set(prev);

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      });
    },
    []
  );

  const handleClickHideAll = useCallback(
    (catColorMap: Record<string, string>) => {
      setHiddenLegendValues(() => {
        const allKeys = new Set(Reflect.ownKeys(catColorMap as object));
        return new Set(allKeys);
      });
    },
    []
  );

  const handleClickShowAll = useCallback(() => {
    setHiddenLegendValues(new Set());
  }, []);

  return {
    hiddenLegendValues: hiddenLegendValues as Set<LegendKey>,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  };
}

export function calcMinMax(values: (number | null)[]) {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value != null && value < min) {
      min = value;
    }

    if (value != null && value > max) {
      max = value;
    }
  }

  return { min, max };
}

export function calcBins(values: (number | null)[]) {
  if (values.length === 0) {
    return null;
  }

  const bins = [];
  const { min, max } = calcMinMax(values);

  const NUM_BINS = 10;
  const binSize = (max - min) / NUM_BINS;
  let binStart = min;

  for (let i = 0; i < NUM_BINS; i += 1) {
    const binEnd = i === NUM_BINS - 1 ? max : binStart + binSize;
    bins.push([binStart, binEnd]);
    binStart = binEnd;
  }

  return {
    [LEGEND_RANGE_1]: bins[0],
    [LEGEND_RANGE_2]: bins[1],
    [LEGEND_RANGE_3]: bins[2],
    [LEGEND_RANGE_4]: bins[3],
    [LEGEND_RANGE_5]: bins[4],
    [LEGEND_RANGE_6]: bins[5],
    [LEGEND_RANGE_7]: bins[6],
    [LEGEND_RANGE_8]: bins[7],
    [LEGEND_RANGE_9]: bins[8],
    [LEGEND_RANGE_10]: bins[9],
  };
}

export function calcVisibility(
  data: DataExplorerPlotResponse | null,
  hiddenLegendValues: any,
  continuousBins: any,
  hide_points?: boolean
) {
  if (!data) {
    return null;
  }

  if (hide_points || hiddenLegendValues.has(LEGEND_ALL)) {
    return data.dimensions.x.values.map(() => false);
  }

  const contKeys = Reflect.ownKeys(continuousBins || {});
  const contValues = findContinuousColorSlice(data)?.values;

  if (contValues) {
    return contValues.map((value: number) => {
      let out = true;

      contKeys.forEach((key, index) => {
        if (hiddenLegendValues.has(key)) {
          const [binStart, binEnd] = continuousBins[key];

          if (value !== null && value >= binStart && value < binEnd) {
            out = false;
          }

          if (index === contKeys.length - 1 && value === binEnd) {
            out = false;
          }
        }
      });

      if (hiddenLegendValues.has(LEGEND_OTHER) && value === null) {
        out = false;
      }

      return out;
    });
  }

  const catValues = findCategoricalSlice(data)?.values;

  if (catValues) {
    const hideOthers = hiddenLegendValues.has(LEGEND_OTHER);

    return catValues.map((value) => {
      if (hiddenLegendValues.has(value)) {
        return false;
      }

      if (hideOthers && !value) {
        return false;
      }

      return true;
    });
  }

  const c1Values = data.filters?.color1?.values;
  const c2Values = data.filters?.color2?.values;
  const visiblePoints = data.dimensions.x.values.map(() => true);

  if (c1Values && hiddenLegendValues.has(data.filters.color1!.name)) {
    c1Values.forEach((value: boolean, i: number) => {
      if (value && !(c2Values || [])[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (c2Values && hiddenLegendValues.has(data.filters.color2!.name)) {
    c2Values.forEach((value: boolean, i: number) => {
      if (value && !(c1Values || [])[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (c1Values && c2Values && hiddenLegendValues.has(LEGEND_BOTH)) {
    c1Values.forEach((value: boolean, i: number) => {
      if (value && c2Values[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (hiddenLegendValues.has(LEGEND_OTHER)) {
    const primary = c1Values || c2Values;
    const other = c2Values || [];

    primary?.forEach((value: boolean, i: number) => {
      if (!value && !other[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  return visiblePoints;
}

export function getLegendKeysWithNoData(data: any, continuousBins: any) {
  const catData = findCategoricalSlice(data);
  const visible = data?.filters?.visible;

  if (catData && visible) {
    const counts: Record<string, number> = {};
    const unusedKeys = new Set();

    for (let i = 0; i < catData.values.length; i += 1) {
      const category = catData.values[i];
      counts[category] = counts[category] || 0;
      counts[category] += visible.values[i] ? 1 : 0;
    }

    Object.keys(counts).forEach((category) => {
      if (counts[category] === 0) {
        unusedKeys.add(category);
      }
    });

    return unusedKeys as Set<LegendKey>;
  }

  const contData = data?.dimensions?.color;

  if (!contData || !continuousBins) {
    return null;
  }

  const out: any = [];
  const len = contData.values.length;
  const keys = Reflect.ownKeys(continuousBins);
  const unusedKeys = new Set(keys);

  for (let i = 0; i < len; i += 1) {
    const value = contData.values[i];
    let found = false;

    if (value === null) {
      out[i] = LEGEND_OTHER;
      found = true;
      unusedKeys.delete(LEGEND_OTHER);
    }

    keys.forEach((key: any, j) => {
      const [binStart, binEnd] = (continuousBins as any)[key];

      if (
        !found &&
        data.dimensions?.x.values[i] !== null &&
        data.dimensions?.y?.values[i] !== null &&
        ((value >= binStart && value < binEnd) ||
          (j === keys.length - 1 && value >= binStart && value <= binEnd))
      ) {
        found = true;
        out[i] = key;
        unusedKeys.delete(key);
      }
    });
  }

  return unusedKeys as Set<LegendKey>;
}

const hasSomeMatchingTrueValue = (a: boolean[], b: boolean[]) => {
  const len = a.length;

  for (let i = 0; i < len; i += 1) {
    if (a[i] && b[i]) {
      return true;
    }
  }

  return false;
};

const hasSomeUniqueValues = (a: boolean[], b: boolean[] | undefined) => {
  if (!b) {
    return true;
  }

  const len = a.length;

  for (let i = 0; i < len; i += 1) {
    if (a[i] && !b[i]) {
      return true;
    }
  }

  return false;
};

const hasSomeNullValuesUniqueToDimension = (
  dimensions: any,
  dimensionKey: string
) => {
  const otherDims = Object.keys(dimensions).filter(
    (key) => key !== dimensionKey
  );

  const { values } = dimensions[dimensionKey];
  const len = values.length;

  for (let i = 0; i < len; i += 1) {
    if (
      values[i] === null &&
      otherDims.every((key) => dimensions[key].values[i] !== null)
    ) {
      return true;
    }
  }

  return false;
};

const hasSomeUncoloredPoints = (
  c1Values: boolean[] | undefined,
  c2Values: boolean[] | undefined,
  dimensions: Record<string, { values: unknown[] }> | null
) => {
  const len = c1Values?.length || c2Values?.length || 0;

  for (let i = 0; i < len; i += 1) {
    if (c1Values && c2Values) {
      if (
        !c1Values[i] &&
        !c2Values[i] &&
        dimensions?.x?.values[i] !== null &&
        dimensions?.y?.values[i] !== null
      ) {
        return true;
      }
    } else if ((c1Values && !c1Values[i]) || (c2Values && !c2Values[i])) {
      return true;
    }
  }

  return false;
};

export function categoricalDataToValueCounts(
  catData: (string | symbol | null)[] | null | undefined,
  visible: boolean[]
) {
  const countMap: Map<string | symbol | null, number> = new Map();

  if (!catData) {
    return countMap;
  }

  for (let i = 0; i < catData.length; i += 1) {
    if (visible[i]) {
      const category = catData[i];
      const total = countMap.get(category) || 0;
      countMap.set(category, total + 1);
    }
  }

  return countMap;
}

const findPlottableCategories = (
  catValues: string[],
  dimensions: Record<string, { values: unknown[] }> | null,
  visible: boolean[]
) => {
  const out = new Set<string>();

  if (!dimensions) {
    return out;
  }

  for (let i = 0; i < catValues.length; i += 1) {
    const category = catValues[i];

    if (!out.has(category) && visible[i]) {
      const plottable = [dimensions.x, dimensions.y]
        .filter(Boolean)
        .every((dim) => dim.values[i] !== null);

      if (plottable) {
        out.add(category);
      }
    }
  }

  return out;
};

const hasPlottableNulls = (
  values: string[] | null,
  dimensions: Record<string, { values: unknown[] }> | null,
  visible: boolean[]
) => {
  if (!values) {
    return false;
  }

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value === null) {
      const dimensionsAreNotNull = Object.keys(dimensions || {})
        .filter((key) => key !== "color")
        .every((key) => dimensions![key].values[i] !== null);

      if (dimensionsAreNotNull && visible[i]) {
        return true;
      }
    }
  }

  return false;
};

function makeCategoricalColorMap(
  values: string[] | null,
  dimensions: Record<string, { dataset_id: string; values: unknown[] }> | null,
  filters: Record<string, { values: boolean[] }> | null,
  metadata: DataExplorerMetadata | null,
  palette: DataExplorerColorPalette
) {
  if (!values) {
    return null;
  }

  const out: Partial<Record<LegendKey, string>> = {};
  const visible = filters?.visible?.values || Array(values.length).fill(true);
  const counts = categoricalDataToValueCounts(values, visible);

  const plottableCategories = findPlottableCategories(
    values,
    dimensions,
    visible
  );

  const keys = ([...counts.keys()].filter(Boolean) as string[])
    .filter((key) => counts.get(key)! > 0 && plottableCategories.has(key))
    .sort(collator.compare);

  const legacySliceId = (metadata?.color_property as { slice_id?: string })
    ?.slice_id;

  if (
    legacySliceId?.startsWith("slice/mutations_prioritized/") ||
    dimensions?.color?.dataset_id === wellKnownDatasets.mutations_prioritized
  ) {
    const fixedColors = {
      "Other conserving": colorPalette.other_conserving_color,
      "Other non-conserving": colorPalette.other_non_conserving_color,
      Damaging: colorPalette.damaging_color,
      Hotspot: colorPalette.hotspot_color,
      Other: colorPalette.other_conserving_color,
    };

    keys.forEach((key) => {
      out[key] =
        key in fixedColors
          ? fixedColors[key as keyof typeof fixedColors]
          : palette.other;
    });
  } else {
    const colors =
      keys.length <= palette.qualitativeFew.length
        ? palette.qualitativeFew
        : palette.qualitativeMany;

    keys.forEach((key, i) => {
      out[key] = colors[i % colors.length];
    });
  }

  if (hasPlottableNulls(values, dimensions, visible)) {
    out[LEGEND_OTHER] = palette.other;
  }

  return out;
}

export function getColorMap(
  data: any,
  plotConfig: any,
  palette: DataExplorerColorPalette,
  sortedLegendKeys?: any
) {
  if (!data) {
    return {
      [LEGEND_ALL]: palette.all,
    };
  }

  if (data.dimensions?.color?.values?.length === 0) {
    return {
      [LEGEND_ALL]: palette.all,
    };
  }

  let colorMap: Partial<Record<LegendKey, string>> = {};

  const catSlice = findCategoricalSlice(data);
  const contSlice = findContinuousColorSlice(data);

  if (catSlice) {
    colorMap = makeCategoricalColorMap(
      catSlice.values as string[],
      data.dimensions,
      data.filters,
      data.metadata,
      palette
    ) as any;
  }

  if (contSlice) {
    colorMap = {
      [LEGEND_RANGE_1]: palette.sequentialScale[0][1],
      [LEGEND_RANGE_2]: palette.sequentialScale[1][1],
      [LEGEND_RANGE_3]: palette.sequentialScale[2][1],
      [LEGEND_RANGE_4]: palette.sequentialScale[3][1],
      [LEGEND_RANGE_5]: palette.sequentialScale[4][1],
      [LEGEND_RANGE_6]: palette.sequentialScale[5][1],
      [LEGEND_RANGE_7]: palette.sequentialScale[6][1],
      [LEGEND_RANGE_8]: palette.sequentialScale[7][1],
      [LEGEND_RANGE_9]: palette.sequentialScale[8][1],
      [LEGEND_RANGE_10]: palette.sequentialScale[9][1],
    };
  }

  if (data.filters?.color1) {
    if (
      hasSomeUniqueValues(
        data.filters.color1.values,
        data.filters.color2?.values
      )
    ) {
      const { name } = data.filters.color1;
      colorMap[name] = palette.compare1;
    }
  }

  if (data.filters?.color2) {
    if (
      hasSomeUniqueValues(
        data.filters.color2.values,
        data.filters.color1?.values
      )
    ) {
      const { name } = data.filters.color2;
      colorMap[name] = palette.compare2;
    }
  }

  if (
    data.filters?.color1 &&
    data.filters?.color2 &&
    hasSomeMatchingTrueValue(
      data.filters.color1.values,
      data.filters.color2.values
    )
  ) {
    colorMap[LEGEND_BOTH] = palette.compareBoth;
  }

  if (data.filters?.color1 || data.filters?.color2) {
    if (
      hasSomeUncoloredPoints(
        data.filters?.color1?.values,
        data.filters?.color2?.values,
        data.dimensions
      )
    ) {
      colorMap[LEGEND_OTHER] = palette.other;
    }
  }

  if (
    contSlice &&
    hasSomeNullValuesUniqueToDimension(data.dimensions, "color")
  ) {
    colorMap[LEGEND_OTHER] = palette.other;
  }

  if (Reflect.ownKeys(colorMap).length === 0) {
    colorMap[LEGEND_ALL] = palette.all;
  }

  if (sortedLegendKeys) {
    const sortedColorMap: any = {};

    sortedLegendKeys.forEach((key: LegendKey) => {
      sortedColorMap[key] = colorMap[key];
    });

    return sortedColorMap;
  }

  return colorMap;
}

export function countExclusivelyTrueValues(
  inGroup: (boolean | null)[] | null,
  outGroup: (boolean | null)[] | null,
  visible: boolean[]
) {
  let sum = 0;

  if (!inGroup) {
    return sum;
  }

  for (let i = 0; i < inGroup.length; i += 1) {
    sum += visible[i] && inGroup[i] && !outGroup?.[i] ? 1 : 0;
  }

  return sum;
}

export function countInclusivelyTrueValues(
  inGroup: (boolean | null)[] | null,
  outGroup: (boolean | null)[] | null,
  visible: boolean[]
) {
  let sum = 0;

  if (!inGroup || !outGroup) {
    return sum;
  }

  for (let i = 0; i < inGroup.length; i += 1) {
    sum += visible[i] && inGroup[i] && outGroup[i] ? 1 : 0;
  }

  return sum;
}

export const ceil = (n: number, p: number) => Math.ceil(n * p) / p;
export const floor = (n: number, p: number) => Math.floor(n * p) / p;

export function precision(n: number) {
  const decimalPart = `${n}`.split(".")[1];

  if (!decimalPart) {
    return 1;
  }

  let e = 10;

  for (let i = 0; i < decimalPart.length; i += 1) {
    if (decimalPart[i] !== "0") {
      return e * 10;
    }

    e *= 10;
  }

  return 100;
}

export type ContinuousBins = ReturnType<typeof calcBins>;

export function categoryToDisplayName(
  category: LegendKey,
  data: {
    dimensions?: {
      color?: object;
    };
    filters: {
      color1?: { name: string };
      color2?: { name: string };
    };
  },
  continuousBins: ContinuousBins
) {
  if (category === LEGEND_BOTH) {
    return `Both (${[data.filters.color1!.name, data.filters.color2!.name].join(
      " & "
    )})`;
  }

  if (category === LEGEND_ALL) {
    return "All";
  }

  if (category === LEGEND_OTHER) {
    const catSlice = findCategoricalSlice(data as DataExplorerPlotResponse);
    const hasOther = catSlice?.values.some(
      (val) => val === "other" || val === "Other"
    );

    return catSlice && !hasOther ? "Other" : "N/A";
  }

  if (typeof category === "symbol") {
    if (!continuousBins) {
      throw new Error("Can't create legend label without `continuousBins`.");
    }

    const [binStart, binEnd] = continuousBins[category];
    const p = precision(Math.abs(binEnd - binStart));

    if (!Number.isFinite(binStart) || !Number.isFinite(binEnd)) {
      return "No data";
    }

    return [ceil(binStart, p), floor(binEnd, p)];
  }

  return category;
}

const sortLegendKeys = (
  dimensionValues: (number | null)[],
  visibleValues: boolean[] | null,
  catData: any,
  sort_by: string | undefined
) => {
  if (sort_by === "mean_values_asc" || sort_by === "mean_values_desc") {
    const meansByCategory: any = {};

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const mean = meansByCategory[legendKey];
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        if (!mean) {
          meansByCategory[legendKey] = [value, 1];
        } else {
          const [sum, divisor] = mean;
          meansByCategory[legendKey] = [sum + value, divisor + 1];
        }
      }
    }

    return Reflect.ownKeys(meansByCategory).sort((keyA, keyB) => {
      const [sumA, divisorA] = meansByCategory[keyA];
      const [sumB, divisorB] = meansByCategory[keyB];
      const a = sumA / divisorA;
      const b = sumB / divisorB;

      return sort_by === "mean_values_asc" ? a - b : b - a;
    });
  }

  if (sort_by === "alphabetical") {
    const valuesByCategory: any = {};

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        valuesByCategory[legendKey] = legendKey;
      }
    }

    return Reflect.ownKeys(valuesByCategory).sort(compareLegendKeys);
  }

  if (sort_by === "num_points") {
    const numPointsByCategory: any = {};
    const meansByCategory: any = {};

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const mean = meansByCategory[legendKey];
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        numPointsByCategory[legendKey] ||= 0;
        numPointsByCategory[legendKey]++;

        if (!mean) {
          meansByCategory[legendKey] = [value, 1];
        } else {
          const [sum, divisor] = meansByCategory[legendKey];
          meansByCategory[legendKey] = [sum + value, divisor + 1];
        }
      }
    }

    return Reflect.ownKeys(numPointsByCategory).sort((keyA, keyB) => {
      const a = numPointsByCategory[keyA];
      const b = numPointsByCategory[keyB];

      if (a === b) {
        // use mean to break ties
        const [sumA, divisorA] = meansByCategory[keyA];
        const [sumB, divisorB] = meansByCategory[keyB];
        const meanA = sumA / divisorA;
        const meanB = sumB / divisorB;

        return meanA - meanB;
      }

      return b - a;
    });
  }

  const valuesByCategory: any = {};

  for (let i = 0; i < catData.values.length; i += 1) {
    const key = catData.values[i];
    const legendKey = key === null ? LEGEND_OTHER : key;
    const minOrMax = valuesByCategory[legendKey];
    const value = dimensionValues[i];

    if (value !== null && (!visibleValues || visibleValues[i])) {
      if (
        minOrMax === undefined ||
        (sort_by === "min_values" && value < minOrMax) ||
        (sort_by === "max_values" && value > minOrMax)
      ) {
        valuesByCategory[legendKey] = value;
      }
    }
  }

  return Reflect.ownKeys(valuesByCategory).sort((keyA, keyB) => {
    const a = valuesByCategory[keyA];
    const b = valuesByCategory[keyB];

    return sort_by === "min_values" ? a - b : b - a;
  });
};

const sortLegendKeys1D = (
  data: any,
  catData: any,
  sort_by: string | undefined
) => {
  const visibleValues = data.filters?.visible
    ? data.filters.visible.values
    : null;

  return sortLegendKeys(
    data.dimensions.x.values,
    visibleValues,
    catData,
    sort_by
  );
};

export const sortLegendKeysWaterfall = (
  data: any,
  catData: any,
  sort_by: string | undefined
) => {
  const visibleValues = data.filters?.visible
    ? data.filters.visible.values
    : null;

  return sortLegendKeys(
    data.dimensions.y.values,
    visibleValues,
    catData,
    sort_by
  );
};

export function continuousValuesToLegendKeySeries(
  contValues: (number | null)[],
  continuousBins: ContinuousBins
) {
  const series: any = [];
  const len = contValues.length;
  const keys = Reflect.ownKeys(continuousBins || {});
  const unusedKeys = new Set(keys);

  for (let i = 0; i < len; i += 1) {
    const value = contValues[i];
    let found = false;

    if (value === null) {
      series[i] = LEGEND_OTHER;
      found = true;
      unusedKeys.delete(LEGEND_OTHER);
    }

    keys.forEach((key: any, j) => {
      const [binStart, binEnd] = (continuousBins as any)[key];
      const isLastBin = j === keys.length - 1;

      if (
        !found &&
        value !== null &&
        value >= binStart &&
        (value < binEnd || (isLastBin && value === binEnd))
      ) {
        found = true;
        series[i] = key;
        unusedKeys.delete(key);
      }
    });
  }

  return [series, unusedKeys];
}

export function calcDensityStats(
  data: any,
  continuousBins: any,
  sort_by: string | undefined
) {
  const color1 = data?.filters?.color1;
  const color2 = data?.filters?.color2;
  const catData = findCategoricalSlice(data);
  const contData = findContinuousColorSlice(data);
  const visible = data?.filters?.visible;

  if (color1 || color2) {
    const out = [];
    const len = (color1 || color2).values.length;
    const unusedKeys = new Set(
      color1 && color2 ? [LEGEND_BOTH, LEGEND_OTHER] : [LEGEND_OTHER]
    );

    for (let i = 0; i < len; i += 1) {
      if (color1?.values[i] && color2?.values[i]) {
        out[i] = LEGEND_BOTH;

        if (!visible || visible.values[i]) {
          unusedKeys.delete(LEGEND_BOTH);
        }
      } else if (color1?.values[i]) {
        out[i] = color1.name;
      } else if (color2?.values[i]) {
        out[i] = color2.name;
      } else {
        out[i] = LEGEND_OTHER;

        if (!visible || visible.values[i]) {
          unusedKeys.delete(LEGEND_OTHER);
        }
      }
    }

    return [out, unusedKeys];
  }

  if (catData) {
    const counts: Record<string, number> = {};
    const unusedKeys = new Set();

    if (visible) {
      for (let i = 0; i < catData.values.length; i += 1) {
        const category = catData.values[i];
        counts[category] = counts[category] || 0;
        counts[category] +=
          visible.values[i] && data.dimensions.x.values[i] !== null ? 1 : 0;
      }

      Object.keys(counts).forEach((category) => {
        if (counts[category] === 0) {
          unusedKeys.add(category);
        }
      });
    }

    return [
      catData.values.map((x: unknown) => (x === null ? LEGEND_OTHER : x)),
      unusedKeys,
      sortLegendKeys1D(data, catData, sort_by),
    ];
  }

  if (contData) {
    const [series, unusedKeys] = continuousValuesToLegendKeySeries(
      contData.values,
      continuousBins
    );

    return [series, unusedKeys];
  }

  return [null];
}

export function isEveryValueNull(values: any[]) {
  if (!values || values.length === 0) {
    return false;
  }

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== null) {
      return false;
    }
  }

  return true;
}

export function getRange(values?: number[]) {
  let min = Infinity;
  let max = -Infinity;

  if (values) {
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];

      if (value !== null && value !== undefined) {
        if (value < min) {
          min = value;
        }

        if (value > max) {
          max = value;
        }
      }
    }
  }

  return [min, max];
}

// Given a series of points, spreads out the annotations such that their tails
// don't overlap.
export function calcAnnotationPositions(
  x: number[],
  y: number[],
  pointIndices: number[],
  // Undocumented Plotly property
  fullLayout: {
    xaxis: { l2p: (x: number) => number };
    yaxis: { l2p: (y: number) => number };
  }
) {
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pointIndices.length; i += 1) {
    const px = x[pointIndices[i]] || 0;
    const py = y[pointIndices[i]] || 0;
    sumX += px;
    sumY += py;
    minX = px < minX ? px : minX;
    minY = py < minY ? py : minY;
    maxX = px > maxX ? px : maxX;
    maxY = py > maxY ? py : maxY;
  }

  const avgX = sumX / pointIndices.length;
  const avgY = sumY / pointIndices.length;

  // Get the center of the point cloud in screen coordinates, using an
  // undocumented `l2p` function (linear-to-pixel)
  // https://community.plotly.com/t/how-to-customize-plotly-tooltip/332/13
  const cx = fullLayout.xaxis.l2p(avgX);
  const cy = fullLayout.yaxis.l2p(avgY);

  // Find how wide/tall the selection is on screen.
  const pixelRangeX = Math.abs(
    fullLayout.xaxis.l2p(maxX) - fullLayout.xaxis.l2p(minX)
  );
  const pixelRangeY = Math.abs(
    fullLayout.yaxis.l2p(maxY) - fullLayout.yaxis.l2p(minY)
  );

  if (pointIndices.length === 1 || pixelRangeX > 300) {
    return pointIndices.map((pointIndex) => ({ pointIndex, ax: -20, ay: -30 }));
  }

  if (pixelRangeX === 0 && pixelRangeY !== 0) {
    return pointIndices
      .sort((a, b) => y[b] - y[a])
      .map((pointIndex, i) => ({
        pointIndex,
        ax: 100 * (i % 2 ? -1 : 1),
        ay: Math.min(Math.floor(i / 2) * 10, 100),
      }));
  }

  if (pixelRangeY === 0 && pixelRangeX !== 0) {
    const ax: number[] = [];
    const ay: number[] = [];
    let dx = -pixelRangeX;
    let dy = -100;

    for (let i = 0; i < pointIndices.length; i += 1) {
      ax[i] = dx;
      ay[i] = dy;
      dx += (pixelRangeX * 2) / pointIndices.length;
      dy += 100 / pointIndices.length;
    }

    return pointIndices
      .sort((a, b) => x[a] - x[b])
      .map((pointIndex, i) => ({
        pointIndex,
        ax: ax[i],
        ay: i % 2 ? ay[i] : -ay[pointIndices.length - i - 1],
      }));
  }

  if (pixelRangeY > 300) {
    return pointIndices.map((pointIndex) => ({ pointIndex, ax: 100, ay: 0 }));
  }

  // This radius is used push the annotations out in a circular pattern,
  // centered around the point (cx, cy).
  let radius = Math.max(pixelRangeX, pixelRangeY);
  radius = Math.max(80, radius);
  radius = Math.min(200, radius);

  // We extend the radius in cases where points are packed closely together
  // along the circle.
  const isSmallDifferenceInAngle = (aRads: number, bRads: number) => {
    const delta = Math.abs(aRads - bRads);

    if (pointIndices.length < 7) {
      return delta < 0.6;
    }

    return delta < Math.PI / pointIndices.length;
  };

  let extraRadius = 0;

  return pointIndices
    .map((pointIndex, i) => {
      const px = fullLayout.xaxis.l2p(x[pointIndex]);
      const py = fullLayout.yaxis.l2p(y[pointIndex]);

      // Find angle to the center point
      let rads = Math.atan2(py - cy, px - cx) % (Math.PI * 2);

      // Special case to spread out coincident and colinear points
      if (px === cx || py === cy) {
        rads = ((Math.PI * 4) / pointIndices.length) * i;
      }

      return {
        pointIndex,
        rads,
        py,
        dx: cx - px,
        dy: cy - py,
      };
    })
    .sort((a, b) => a.rads - b.rads)
    .map(({ pointIndex, rads, dx, dy, py }: any, index: number, others) => {
      const other =
        index === 0 ? others[pointIndices.length - 1] : others[index - 1];

      if (isSmallDifferenceInAngle(rads, other.rads)) {
        extraRadius += (extraRadius || radius) ** 0.8;

        if (extraRadius > 150) {
          extraRadius = 0;
        }
      } else {
        extraRadius = 0;
      }

      const ax = Math.cos(rads) * (radius + extraRadius) + dx;
      let ay = Math.sin(rads) * (radius + extraRadius) + dy;

      // Don't let annotations escape off the top of the plot.
      if (py + ay < 0) {
        ay = -py;
      }

      return { pointIndex, ax, ay };
    });
}

// `calcAutoscaleShapes()` is a hack that creates an invisible line. This can
// be used to trick Plotly's autoscaling into forcing the x and y axis scales
// to match.
export function calcAutoscaleShapes(
  showIdentityLine: boolean,
  extents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    ratio: number;
  }
): Layout["shapes"] {
  if (!showIdentityLine || extents.ratio < 0.1) {
    return [];
  }

  const x0 = Math.min(extents.minX, extents.minY);
  const x1 = Math.max(extents.maxX, extents.maxY);
  const y0 = x0;
  const y1 = x1;

  return [
    {
      type: "line",
      xref: "x",
      yref: "y",
      x0,
      x1,
      y0,
      y1,
      line: { color: "transparent" },
    },
  ];
}

export function calcPlotIndicatorLineShapes(
  showIdentityLine: boolean,
  regressionLines: RegressionLine[] | null | undefined,
  extents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    rangeX: number;
    rangeY: number;
  },
  simulateInfiteLength?: boolean
) {
  const shapes: Layout["shapes"] = [];
  const extraLength = simulateInfiteLength
    ? Math.max(extents.rangeX, extents.rangeY) * 10
    : 0;

  const p0 =
    extents.minX < extents.minY || !showIdentityLine
      ? extents.minX - extraLength
      : extents.minY - extraLength;

  const p1 =
    extents.maxX > extents.maxY || !showIdentityLine
      ? extents.maxX + extraLength
      : extents.maxY + extraLength;

  if (showIdentityLine) {
    const shape: Layout["shapes"][0] = {
      type: "line",
      xref: "x",
      yref: "y",
      x0: p0,
      x1: p1,
      y0: p0,
      y1: p1,
    };

    const solidLine = { width: 1, color: "#FFFFFF66" };
    const dottedLine = { width: 1, color: "#444", dash: "dot" as const };
    shapes.push({ ...shape, line: solidLine });
    shapes.push({ ...shape, line: dottedLine });
  }

  if (regressionLines) {
    regressionLines.forEach((line) => {
      if (line.hidden) {
        return;
      }

      const shape: Layout["shapes"][0] = {
        layer: "above",
        type: "line",
        xref: "x",
        yref: "y",
        xanchor: 2,
        yanchor: 2,
        x0: p0,
        x1: p1,
        y0: line.m * p0 + line.b,
        y1: line.m * p1 + line.b,
      };

      const contrastLine = { width: 4, color: "ffffff88" };
      const mainLine = { width: 2, color: line.color };
      shapes.unshift({ ...shape, line: contrastLine });
      shapes.push({ ...shape, line: mainLine });
    });
  }

  return shapes;
}
