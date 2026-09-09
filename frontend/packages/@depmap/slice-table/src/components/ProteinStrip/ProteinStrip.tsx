import React, { useEffect, useRef } from "react";
import { useNightingale } from "./loadNightingale";
import { StripScale } from "./scales";
import styles from "../../styles/ProteinStrip.scss";

// How tall the band is. Small enough to sit in a table row without changing its
// height, tall enough to read as a band rather than a rule.
const STRIP_HEIGHT = 14;

interface Props {
  sequence: string;
  scale: StripScale;
}

// Deliberately no tooltip, native or otherwise. The table already puts one on
// any cell whose content overflows (see useTruncatedCellTooltip), and it shows
// the raw cell value -- which for these columns is the several-hundred-
// character string the band exists to replace. The band fills the cell exactly,
// so that tooltip should not trigger; adding a `title` here would introduce a
// second one that fires unconditionally.

// One residue-per-pixel(ish) colored band, for a per-residue string rendered at
// a width where individual residues are sub-pixel.
//
// Worth knowing about what Nightingale draws at this size: below 8 pixels per
// residue it stops emitting one rect per residue and switches to a single rect
// filled with an SVG linear gradient that has one stop per residue. For a
// continuous quantity that is exactly right. For a categorical band it means
// class boundaries are interpolated rather than hard -- but the blend spans one
// residue, which at these widths is a fraction of a pixel, so the band still
// reads as solid blocks. It does mean the strip is a picture of the annotation
// and not a way to read any individual position; that is what the table cell's
// text value and the transcript detail views are for.
function ProteinStrip({ sequence, scale }: Props) {
  const ready = useNightingale();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!ready || !container) {
      return undefined;
    }

    // Built with createElement rather than written as JSX. React 16 has no
    // model for custom elements: it would stringify every prop into an
    // attribute, which is wrong for `sequence` (a Lit property) and gives no
    // way to talk to the element imperatively. Doing it by hand also keeps the
    // tag out of TypeScript's JSX namespace, so this stays a local concern
    // instead of a global IntrinsicElements declaration.
    //
    // Safe to assign properties immediately: we only get here after the import
    // resolved, so the element is already upgraded and Lit's accessors exist.
    // Creating one before registration would silently shadow them.
    const el = document.createElement(
      "nightingale-colored-sequence"
    ) as HTMLElement & { sequence: string };

    // Width is deliberately absent from this list. Nightingale's resize mixin
    // only auto-sizes a dimension whose attribute is unset, so omitting it is
    // what makes the band follow the column as the user drags it wider --
    // setting it would freeze the band at whatever the column happened to be
    // when the cell mounted.
    el.setAttribute("height", String(STRIP_HEIGHT));
    el.setAttribute("length", String(sequence.length));
    el.setAttribute("display-start", "1");
    el.setAttribute("display-end", String(sequence.length));
    el.setAttribute("scale", scale.scale);
    el.setAttribute("color-range", scale.colorRange);

    // A property, not an attribute: it's a few hundred characters that would
    // otherwise sit in the DOM on every row.
    el.sequence = sequence;

    container.appendChild(el);

    return () => {
      el.remove();
    };
  }, [ready, sequence, scale]);

  // Shown while the chunk loads, and permanently if it fails to. Not the
  // sequence itself: that overflows the column, which both widens the cell and
  // trips the table's own truncation tooltip -- so the fallback would flash
  // exactly the wall of text the band replaces. The length is the one thing
  // about the value that fits, and it degrades honestly.
  if (!ready) {
    return <span className={styles.fallback}>{sequence.length} aa</span>;
  }

  return <div ref={containerRef} className={styles.strip} />;
}

export default ProteinStrip;
