import React from "react";
import ProteinStrip from "./ProteinStrip";
import { StripScale } from "./scales";
import styles from "../../styles/ProteinStrip.scss";

export { default as getProteinStripScale } from "./columns";

// Wide enough that a band is a shape rather than a smear, and wide enough for
// the key in the header to fit on two lines.
export const PROTEIN_STRIP_COLUMN_WIDTH = 260;

// Values come back from Breadbox as whatever the tabular column holds. Anything
// that isn't a non-empty string has no band to draw, and an empty cell is the
// right answer rather than a broken one.
function asSequence(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// The cell renderer for a per-residue column, in the shape SliceTable's column
// definitions expect.
//
// `columnStats` comes from the table rather than the row: it is how a cell
// learns the longest sequence in its column, which is what every band in the
// column is drawn against. It reflects the rows the table was given, so a
// table scoped to one gene scales to that gene's longest transcript, and
// searching within the table does not make the bands jump.
export function proteinStripCell(scale: StripScale) {
  return function ProteinStripCell({
    getValue,
    columnStats = undefined,
  }: {
    getValue: () => unknown;
    columnStats?: { maxLength?: number };
  }) {
    const sequence = asSequence(getValue());

    if (!sequence) {
      return null;
    }

    return (
      <ProteinStrip
        sequence={sequence}
        scale={scale}
        axisLength={columnStats?.maxLength}
      />
    );
  };
}

// The header carries the key for the band below it. That isn't decoration: some
// of these colors sit below 3:1 against the page, so without the labels the
// encoding is color-alone and unreadable to a chunk of users. One key per
// column rather than per cell, for the obvious reason.
export function proteinStripHeader(scale: StripScale) {
  return function ProteinStripHeader({
    defaultElement,
  }: {
    defaultElement: React.ReactNode;
  }) {
    return (
      <div>
        {defaultElement}
        {scale.legend.length > 0 && (
          <div className={styles.legend}>
            {scale.legend.map(({ label: className, color }) => (
              <span key={className} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: color }}
                />
                {className}
              </span>
            ))}
          </div>
        )}
        {scale.gradient && (
          <div className={styles.gradientKey}>
            <span>{scale.gradient.ends[0]}</span>
            <span
              className={styles.gradientBar}
              style={{ background: scale.gradient.css }}
            />
            <span>{scale.gradient.ends[1]}</span>
          </div>
        )}
      </div>
    );
  };
}
