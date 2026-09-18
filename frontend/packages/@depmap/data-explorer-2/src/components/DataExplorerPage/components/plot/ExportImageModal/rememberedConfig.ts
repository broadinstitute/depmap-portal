import {
  isValidNumber,
  PLOT_STYLE_BOUNDS,
  BoundedStyleKey,
} from "../../../../SettingsModal/utils";
import {
  DimensionUnit,
  isValidResolution,
} from "../../../../../utils/lengthUnits";
import type { DataExplorerPlotType } from "@depmap/types";
import type { ExportLegendPosition } from "../prototype/plotUtils";
import {
  CHROME_LINE_WIDTH_BOUNDS,
  DATA_LINE_WIDTH_BOUNDS,
  DEFAULT_EXPORT_CONFIG,
  DIMENSION_BOUNDS,
  EDGE_PADDING_BOUNDS,
  ExportConfig,
  ExportImageFormat,
  TICK_FONT_SIZE_BOUNDS,
  VIOLIN_LINE_WIDTH_BOUNDS,
} from "./exportDefaults";

// Shared across every plot type: these describe the output target (a slide,
// a print page), not any one plot's own quirks, so picking a size for a
// scatter export shouldn't be forgotten the next time it's a heatmap.
const SHARED_STORAGE_KEY = "data_explorer_2_image_export";

// Everything else is remembered per plot type instead — each renderer's own
// automargin/chrome/font behavior is different enough that, say, a
// chromeLineWidth tuned to look right on a heatmap can look wrong on a
// scatter plot. One key per DataExplorerPlotType, so tuning one never
// bleeds into another.
const perTypeStorageKey = (plotType: DataExplorerPlotType) =>
  `data_explorer_2_image_export_${plotType}`;

const UNITS: DimensionUnit[] = ["px", "in", "cm", "mm", "pt"];
const LEGEND_POSITIONS: ExportLegendPosition[] = ["right", "above", "hidden"];
const FORMATS: ExportImageFormat[] = ["png", "svg"];

type SharedRemembered = {
  width: number;
  height: number;
  unit: DimensionUnit;
  resolution: number;
  format: ExportImageFormat;
};

// Only the fields the modal actually lets someone change. Notably absent:
// the palette. Colors are taken from the user's saved settings every time
// (see the modal's own note on why they can't diverge yet), so persisting a
// copy here would create a second, staler source for them.
type PerTypeRemembered = {
  legendPosition: ExportLegendPosition;
  edgePadding: number;
  chromeLineWidth: number;
  dataLineWidth: number;
  violinLineWidth: number;
  tickFontSize: number;
} & Record<BoundedStyleKey, number>;

// Reads and JSON-parses one localStorage key, returning `null` (rather than
// throwing) for anything missing or malformed — a payload from an earlier
// version of the app can say anything: a field since removed, a value
// since re-bounded, or hand-edited nonsense. Every caller below
// re-validates each field it actually reads against the current bounds.
function readStoredObject(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected an object");
    }

    return parsed;
  } catch (e) {
    window.console.error("Could not read the remembered export settings:", e);
    return null;
  }
}

// What was last exported with, so the next export starts where the last one
// left off rather than back at the defaults. Written on save rather than on
// every keystroke: the interesting configuration is the one someone
// committed to, not every value they passed through on the way there.
export function rememberExportConfig(
  config: ExportConfig,
  plotType: DataExplorerPlotType
) {
  const shared: SharedRemembered = {
    width: config.width,
    height: config.height,
    unit: config.unit,
    resolution: config.resolution,
    format: config.format,
  };

  const perType: PerTypeRemembered = {
    legendPosition: config.legendPosition,
    edgePadding: config.edgePadding,
    chromeLineWidth: config.chromeLineWidth,
    dataLineWidth: config.dataLineWidth,
    violinLineWidth: config.violinLineWidth,
    tickFontSize: config.tickFontSize,
    ...(Object.fromEntries(
      (Object.keys(PLOT_STYLE_BOUNDS) as BoundedStyleKey[]).map((key) => [
        key,
        config.plotStyles[key],
      ])
    ) as Record<BoundedStyleKey, number>),
  };

  try {
    window.localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(shared));
    window.localStorage.setItem(
      perTypeStorageKey(plotType),
      JSON.stringify(perType)
    );
  } catch (e) {
    // A full or unavailable localStorage is no reason to fail an export the
    // user already asked for.
    window.console.error("Could not remember the export settings:", e);
  }
}

// Every field is checked against the same bounds the UI enforces, and
// anything missing, malformed or out of range falls back to the default
// rather than being trusted. Reads from both the shared and the per-type
// key; a plot type opened for the first time after this split simply
// starts its per-type fields at the defaults, same as if it had never been
// exported before.
export function readRememberedExportConfig(
  plotType: DataExplorerPlotType
): ExportConfig {
  const shared = readStoredObject(SHARED_STORAGE_KEY) ?? {};
  const perType = readStoredObject(perTypeStorageKey(plotType)) ?? {};

  const number = (
    stored: Record<string, unknown>,
    key: string,
    fallback: number,
    min: number,
    max: number
  ) => {
    const value = stored[key];

    return typeof value === "number" && isValidNumber(value, min, max)
      ? value
      : fallback;
  };

  const plotStyles = { ...DEFAULT_EXPORT_CONFIG.plotStyles };

  (Object.keys(PLOT_STYLE_BOUNDS) as BoundedStyleKey[]).forEach((key) => {
    const { min, max } = PLOT_STYLE_BOUNDS[key];
    plotStyles[key] = number(perType, key, plotStyles[key], min, max);
  });

  return {
    width: number(
      shared,
      "width",
      DEFAULT_EXPORT_CONFIG.width,
      DIMENSION_BOUNDS.min,
      DIMENSION_BOUNDS.max
    ),
    height: number(
      shared,
      "height",
      DEFAULT_EXPORT_CONFIG.height,
      DIMENSION_BOUNDS.min,
      DIMENSION_BOUNDS.max
    ),
    unit: UNITS.includes(shared.unit as DimensionUnit)
      ? (shared.unit as DimensionUnit)
      : DEFAULT_EXPORT_CONFIG.unit,
    format: FORMATS.includes(shared.format as ExportImageFormat)
      ? (shared.format as ExportImageFormat)
      : DEFAULT_EXPORT_CONFIG.format,
    resolution:
      typeof shared.resolution === "number" &&
      isValidResolution(shared.resolution)
        ? shared.resolution
        : DEFAULT_EXPORT_CONFIG.resolution,
    legendPosition: LEGEND_POSITIONS.includes(
      perType.legendPosition as ExportLegendPosition
    )
      ? (perType.legendPosition as ExportLegendPosition)
      : DEFAULT_EXPORT_CONFIG.legendPosition,
    edgePadding: number(
      perType,
      "edgePadding",
      DEFAULT_EXPORT_CONFIG.edgePadding,
      EDGE_PADDING_BOUNDS.min,
      EDGE_PADDING_BOUNDS.max
    ),
    chromeLineWidth: number(
      perType,
      "chromeLineWidth",
      DEFAULT_EXPORT_CONFIG.chromeLineWidth,
      CHROME_LINE_WIDTH_BOUNDS.min,
      CHROME_LINE_WIDTH_BOUNDS.max
    ),
    dataLineWidth: number(
      perType,
      "dataLineWidth",
      DEFAULT_EXPORT_CONFIG.dataLineWidth,
      DATA_LINE_WIDTH_BOUNDS.min,
      DATA_LINE_WIDTH_BOUNDS.max
    ),
    violinLineWidth: number(
      perType,
      "violinLineWidth",
      DEFAULT_EXPORT_CONFIG.violinLineWidth,
      VIOLIN_LINE_WIDTH_BOUNDS.min,
      VIOLIN_LINE_WIDTH_BOUNDS.max
    ),
    tickFontSize: number(
      perType,
      "tickFontSize",
      DEFAULT_EXPORT_CONFIG.tickFontSize,
      TICK_FONT_SIZE_BOUNDS.min,
      TICK_FONT_SIZE_BOUNDS.max
    ),
    plotStyles,
  };
}
