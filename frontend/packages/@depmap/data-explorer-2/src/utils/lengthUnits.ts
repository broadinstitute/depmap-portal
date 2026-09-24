// Physical units for the export dimensions, in the spirit of Preview.app's
// Tools > Adjust Size.
//
// Pixels remain the single source of truth everywhere else in the modal: the
// unit is a lens on the same stored value, never a second representation of
// it. Converting the state itself on each switch would accumulate rounding
// drift every time someone toggled between inches and pixels.

export type DimensionUnit = "px" | "in" | "cm" | "mm" | "pt";

// CSS reference pixels per inch, so the numbers agree with how the browser
// (and therefore the preview) already reasons about a pixel.
export const DEFAULT_RESOLUTION = 96;

export const MIN_RESOLUTION = 1;
export const MAX_RESOLUTION = 1200;

export const UNIT_OPTIONS: { value: DimensionUnit; label: string }[] = [
  { value: "px", label: "pixels" },
  { value: "in", label: "inches" },
  { value: "cm", label: "centimeters" },
  { value: "mm", label: "millimeters" },
  { value: "pt", label: "points" },
];

// The short form shown beside a field, where the long name would crowd out the
// input in a 240px column.
export const UNIT_SUFFIX: Record<DimensionUnit, string> = {
  px: "px",
  in: "in",
  cm: "cm",
  mm: "mm",
  pt: "pt",
};

// Lengths here come in two wildly different magnitudes, and one set of step
// sizes and decimal places can't serve both. "canvas" is the image's own width
// and height — thousands of pixels, a quarter-inch nudge. "detail" is type and
// marker sizes — tens of pixels, where a quarter-inch step would take a 28 px
// font to 52 px in one press, and two decimals of an inch would quantize it to
// roughly 3 px at 300 dpi.
export type LengthScale = "canvas" | "detail";

const FORMATS: Record<
  LengthScale,
  Record<DimensionUnit, { decimals: number; step: number }>
> = {
  canvas: {
    px: { decimals: 0, step: 10 },
    in: { decimals: 2, step: 0.25 },
    cm: { decimals: 2, step: 0.5 },
    mm: { decimals: 1, step: 5 },
    pt: { decimals: 0, step: 6 },
  },
  detail: {
    px: { decimals: 0, step: 1 },
    // Three decimals so that every whole pixel stays reachable even at 300
    // dpi, where a hundredth of an inch is already 3 px.
    in: { decimals: 3, step: 0.01 },
    cm: { decimals: 2, step: 0.1 },
    mm: { decimals: 1, step: 0.5 },
    // The unit type is conventionally specified in, and at 96 dpi a point is
    // about 1.3 px — so tenths, and a step of one point.
    pt: { decimals: 1, step: 1 },
  },
};

export const stepFor = (unit: DimensionUnit, scale: LengthScale = "canvas") =>
  FORMATS[scale][unit].step;

export const isValidResolution = (dpi: number) =>
  Number.isFinite(dpi) && dpi >= MIN_RESOLUTION && dpi <= MAX_RESOLUTION;

// A point is 1/72 in and a centimeter 1/2.54 in by definition, so every
// physical unit is derived from the resolution — which is exactly why the
// resolution has to be something the user can see and set.
const pxPerUnit = (unit: DimensionUnit, dpi: number) => {
  switch (unit) {
    case "in":
      return dpi;
    case "cm":
      return dpi / 2.54;
    case "mm":
      return dpi / 25.4;
    case "pt":
      return dpi / 72;
    case "px":
    default:
      return 1;
  }
};

// px -> the displayed number. Returns NaN for anything unusable (an empty or
// nonsense resolution), which the number inputs already render as an empty
// field rather than "Infinity".
export const fromPx = (
  px: number,
  unit: DimensionUnit,
  dpi: number,
  lengthScale: LengthScale = "canvas"
) => {
  const scale = pxPerUnit(unit, dpi);

  if (!Number.isFinite(px) || !Number.isFinite(scale) || scale <= 0) {
    return NaN;
  }

  const factor = 10 ** FORMATS[lengthScale][unit].decimals;

  return Math.round((px / scale) * factor) / factor;
};

// The displayed number -> px. Rounded because the exporter deals in whole
// pixels, so a physical size is only ever honored to the nearest one.
export const toPx = (value: number, unit: DimensionUnit, dpi: number) => {
  const scale = pxPerUnit(unit, dpi);

  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0) {
    return NaN;
  }

  return Math.round(value * scale);
};

// The valid range in the display unit, snapped onto the step grid: the low
// bound rounded up, the high bound rounded down.
//
// The snapping is the whole trick, and it is what makes it safe to give these
// inputs a `min` again. A number input's step grid is anchored at `min`, so a
// raw converted bound (a font's 10 px is 0.10417 in) anchors the grid at a
// number that is not a multiple of the step — and the next grid point up from
// wherever you are can then round back to the pixel you started from, which is
// what made the arrows look dead. Snapping `min` to a multiple of the step
// leaves the grid at "multiples of the step", which is exactly the grid you get
// with no `min` at all, so stepping keeps landing on round, distinct values.
//
// Rounding inward rather than outward also means the reachable range sits
// strictly inside the pixel bounds, so the spinner can never produce a value
// the modal would reject.
export const boundsFor = (
  minPx: number,
  maxPx: number,
  unit: DimensionUnit,
  dpi: number,
  lengthScale: LengthScale = "canvas"
) => {
  const scale = pxPerUnit(unit, dpi);
  const step = stepFor(unit, lengthScale);

  if (!Number.isFinite(scale) || scale <= 0) {
    return { min: NaN, max: NaN };
  }

  // Keeps 0.01 * 11 out of the DOM as 0.11000000000000001.
  const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

  return {
    min: tidy(Math.ceil(minPx / scale / step) * step),
    max: tidy(Math.floor(maxPx / scale / step) * step),
  };
};
