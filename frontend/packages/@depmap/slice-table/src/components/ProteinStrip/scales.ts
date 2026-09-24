// Nightingale colors a sequence in two steps, and the split is easy to get
// wrong: `scale` maps each residue CHARACTER to a NUMBER, and `color-range`
// maps NUMBERS to colors through a d3 linear scale. Neither attribute takes a
// character-to-color mapping, which is what a categorical band like topology
// actually wants -- so a categorical encoding has to be smuggled through the
// numeric one by giving each class its own integer and pinning a color to
// exactly that integer. Because the class values are always whole numbers, the
// piecewise-linear interpolation between them is never sampled and every
// residue lands on an exact color.

export interface StripScale {
  // Value for the element's `scale` attribute.
  scale: string;
  // Value for the element's `color-range` attribute.
  colorRange: string;
  // Legend entries, in display order. Empty for a continuous scale.
  legend: { label: string; color: string }[];
  // Set instead of `legend` for a continuous scale, which has no classes to
  // list and gets a labelled gradient bar in the header instead.
  gradient?: { css: string; ends: [string, string] };
}

// Any character Nightingale doesn't find in `scale` is silently given the value
// 0, so 0 must not belong to a real class -- otherwise an unexpected letter
// would render as a confident, wrong annotation. Reserving 0 for a neutral gray
// turns that failure into a visible "we don't know", and shifts the real
// classes to 1..4.
const UNKNOWN_VALUE = 0;
const UNKNOWN_COLOR = "#9a9a94";

// DeepTMHMM-style per-residue topology labels.
//
// Colors are categorical slots 1, 2, 3 and 7 of the portal's viz palette. Slot
// 4 (yellow) is deliberately skipped: every class in this band can sit next to
// every other, so the palette has to hold up under all-pairs validation, and
// yellow-with-orange is exactly the pair that fails it. This set passes all
// pairs in light mode (worst CVD dE 9.2, worst normal-vision dE 16.3). The band
// is light-mode only, like the rest of the portal.
//
// Hue assignment follows the convention these annotations are usually drawn in
// (membrane warm, the two sides cool and distinct), so a reader who has seen a
// topology diagram before doesn't have to relearn it here.
const TOPOLOGY_CLASSES = [
  { code: "S", label: "Signal peptide", value: 1, color: "#4a3aa7" },
  { code: "O", label: "Outside", value: 2, color: "#1baf7a" },
  { code: "M", label: "Membrane", value: 3, color: "#eb6834" },
  { code: "I", label: "Inside", value: 4, color: "#2a78d6" },
];

export const TOPOLOGY_SCALE: StripScale = {
  scale: TOPOLOGY_CLASSES.map(({ code, value }) => `${code}:${value}`).join(
    ","
  ),
  colorRange: [
    `${UNKNOWN_COLOR}:${UNKNOWN_VALUE}`,
    ...TOPOLOGY_CLASSES.map(({ color, value }) => `${color}:${value}`),
  ].join(","),
  legend: TOPOLOGY_CLASSES.map(({ label, color }) => ({ label, color })),
};

export const TOPOLOGY_CODE_TO_LABEL: Record<string, string> = {};
TOPOLOGY_CLASSES.forEach(({ code, label }) => {
  TOPOLOGY_CODE_TO_LABEL[code] = label;
});

// An amino acid sequence has no categorical story to tell at this width -- 200
// pixels of column can't show letters -- so the strip shows the property a
// reader would look at the sequence for anyway. "hydrophobicity-scale" is one
// of Nightingale's built-in residue-to-number tables (Wimley-White, where lower
// is more hydrophobic); we supply only the colors.
//
// Hydrophobicity is a diverging quantity, so it gets the palette's diverging
// treatment: warm and cool poles either side of a neutral gray midpoint, rather
// than the two-hue ramp Nightingale defaults to, which has no neutral and so
// reads as though every residue is strongly one thing or the other.
const HYDROPHOBICITY_MIN = -0.81; // isoleucine, the most hydrophobic
const HYDROPHOBICITY_MID = 0.8;
const HYDROPHOBICITY_MAX = 2.41; // lysine, the most hydrophilic

const HYDROPHOBIC_COLOR = "#e34948";
const NEUTRAL_COLOR = "#f0efec";
const HYDROPHILIC_COLOR = "#2a78d6";

export const HYDROPHOBICITY_SCALE: StripScale = {
  scale: "hydrophobicity-scale",
  colorRange: [
    `${HYDROPHOBIC_COLOR}:${HYDROPHOBICITY_MIN}`,
    `${NEUTRAL_COLOR}:${HYDROPHOBICITY_MID}`,
    `${HYDROPHILIC_COLOR}:${HYDROPHOBICITY_MAX}`,
  ].join(","),
  legend: [],
  gradient: {
    css: `linear-gradient(to right, ${HYDROPHOBIC_COLOR}, ${NEUTRAL_COLOR}, ${HYDROPHILIC_COLOR})`,
    ends: ["phobic", "philic"],
  },
};
