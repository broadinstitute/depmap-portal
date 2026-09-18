import type { Settings } from "../../contexts/DataExplorerSettingsContext";

type PlotStyles = Settings["plotStyles"];

export const updateStyle = (prop: string, value: unknown) => (
  plotStyles: PlotStyles
) =>
  ({
    ...plotStyles,
    [prop]: value,
  } as PlotStyles);

export const updateColor = (prop: string, value: unknown) => (
  plotStyles: PlotStyles
) =>
  ({
    ...plotStyles,
    palette: {
      ...plotStyles.palette,
      [prop]: value,
    },
  } as PlotStyles);

export const isValidNumber = (n: number, min: number, max: number) => {
  return typeof n === "number" && !Number.isNaN(n) && n >= min && n <= max;
};

// Grow or shrink a categorical palette to `n` colors. Growing refills from the
// corresponding default palette so the added swatches are usable colors rather
// than blanks, and only falls back to white once the defaults run out.
export const resizePalette = (
  current: string[],
  n: number,
  defaults: string[]
) => {
  if (n < current.length) {
    return current.slice(0, n);
  }

  const next = [
    ...current,
    ...defaults.filter((_, i) => i >= current.length && i < n),
  ];

  if (next.length < n && n <= 30) {
    for (let i = next.length; i < n; i += 1) {
      next.push("#ffffff");
    }
  }

  return next;
};

// The editable range of each numeric plot style, in one place because three
// things need to agree on it: the form's inputs, the export modal's validity
// check, and the validator that reads a remembered export config back out of
// localStorage. They were duplicated across the first two and drifting was
// only a matter of time.
//
// Lengths are image pixels. `pxStep` is the spinner increment while a field is
// shown in pixels; in a physical unit the step comes from the unit instead.
export const PLOT_STYLE_BOUNDS = {
  pointSize: { min: 3, max: 50 },
  facetedPointSize: { min: 3, max: 50 },
  // A ratio rather than a length, hence `unitless`.
  pointOpacity: { min: 0, max: 1, unitless: true },
  outlineWidth: { min: 0, max: 10, pxStep: 0.5 },
  annotationFontSize: { min: 8, max: 50 },
  xAxisFontSize: { min: 10, max: 50 },
  yAxisFontSize: { min: 10, max: 50 },
} as const;

export type BoundedStyleKey = keyof typeof PLOT_STYLE_BOUNDS;
