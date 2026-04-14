import React from "react";
import styles from "../../styles/AnnotationSelect.scss";

/**
 * A color triplet for dimension type badges and door buttons.
 * bg = pastel background, fg = dark foreground text, border = medium accent.
 */
interface DimColor {
  bg: string;
  fg: string;
  border: string;
}

/**
 * 12 distinct hues, hand-picked for readability as pastel badges.
 * Ordered to maximize perceptual distance between adjacent entries.
 */
const PALETTE: DimColor[] = [
  { bg: "#e0e7ff", fg: "#3730a3", border: "#a5b4fc" }, // indigo
  { bg: "#d1fae5", fg: "#047857", border: "#6ee7b7" }, // emerald
  { bg: "#fce7f3", fg: "#be185d", border: "#f9a8d4" }, // pink
  { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d" }, // amber
  { bg: "#ede9fe", fg: "#6d28d9", border: "#c4b5fd" }, // violet
  { bg: "#cffafe", fg: "#155e75", border: "#67e8f9" }, // cyan
  { bg: "#fce4ec", fg: "#ad1457", border: "#f48fb1" }, // rose
  { bg: "#e8f5e9", fg: "#2e7d32", border: "#81c784" }, // green
  { bg: "#fff3e0", fg: "#e65100", border: "#ffb74d" }, // orange
  { bg: "#e0f7fa", fg: "#00695c", border: "#4dd0e1" }, // teal
  { bg: "#fef9c3", fg: "#854d0e", border: "#fde047" }, // yellow
  { bg: "#f3e5f5", fg: "#7b1fa2", border: "#ce93d8" }, // purple
];

/**
 * Simple deterministic hash of a string to a non-negative integer.
 */
function hashString(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash + char) | 0;
  }

  return Math.abs(hash);
}

// Cache so repeated calls for the same dim type don't re-hash.
const colorCache = new Map<string, DimColor>();

/**
 * Returns a stable color triplet for a dimension type name.
 */
export function dimColor(dimType: string): DimColor {
  let color = colorCache.get(dimType);

  if (!color) {
    color = PALETTE[hashString(dimType) % PALETTE.length];
    colorCache.set(dimType, color);
  }

  return color;
}

/**
 * Returns inline CSS variable style for applying dim colors to an element.
 * Works with any element that uses var(--dim-bg), var(--dim-fg), var(--dim-border).
 */
export function dimColorStyle(dimType: string): React.CSSProperties {
  const c = dimColor(dimType);

  return {
    "--dim-bg": c.bg,
    "--dim-fg": c.fg,
    "--dim-border": c.border,
  } as React.CSSProperties;
}

const DimBadge = React.memo(
  ({ dimType, displayName }: { dimType: string; displayName: string }) => {
    return (
      <span className={styles.dimBadge} style={dimColorStyle(dimType)}>
        {displayName}
      </span>
    );
  }
);

export default DimBadge;
