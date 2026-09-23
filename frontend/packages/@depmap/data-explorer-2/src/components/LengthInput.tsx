import React, { useState } from "react";
import {
  boundsFor,
  DimensionUnit,
  fromPx,
  LengthScale,
  stepFor,
  toPx,
} from "../utils/lengthUnits";
import styles from "../styles/LengthInput.scss";

interface Props {
  id: string;
  // Always pixels. The unit is a lens over this, never a second copy of it.
  valuePx: number;
  minPx: number;
  maxPx: number;
  unit: DimensionUnit;
  resolution: number;
  scale?: LengthScale;
  // Step while showing pixels, where a field may want something finer than
  // whole pixels (outline width has always moved in halves).
  pxStep?: number;
  onChangePx: (px: number) => void;
}

// A number input over a pixel value, shown in whatever unit the caller is
// working in. Exists because a plain controlled number input cannot do this
// correctly — see the two comments below, each of which is a bug this fixes.
function LengthInput({
  id,
  valuePx,
  minPx,
  maxPx,
  unit,
  resolution,
  scale = "canvas",
  pxStep = undefined,
  onChangePx,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const displayed = fromPx(valuePx, unit, resolution, scale);
  const isPx = unit === "px";
  const bounds = isPx
    ? { min: minPx, max: maxPx }
    : boundsFor(minPx, maxPx, unit, resolution, scale);

  // Judged in pixels, not by the browser's own validity. A value converted
  // from a whole pixel usually isn't on the step grid (0.74 cm when the grid
  // runs in tenths), so `:invalid` would flag a perfectly good size as a
  // stepMismatch. This asks the only question that matters: is the size we
  // would actually export out of range?
  //
  // An empty field is only flagged once editing is over. Clearing it to retype
  // is a normal keystroke, not a mistake worth colouring red; a number that is
  // genuinely too small is flagged as you type, which is the point.
  const isEmpty = Number.isNaN(valuePx);
  const isEditing = draft !== null;
  const isOutOfRange = isEmpty
    ? !isEditing
    : valuePx < minPx || valuePx > maxPx;
  // An unusable value (a cleared field, or a nonsense resolution) shows as
  // empty rather than as "NaN".
  const canonicalText = Number.isNaN(displayed) ? "" : String(displayed);

  // The text the user is mid-way through typing, kept only while it still
  // describes the value we hold. Any change from elsewhere (a preset, the
  // slider) disagrees with it and discards it.
  //
  // Without this, typing a decimal was impossible: on "13." we converted 13
  // back to pixels, re-rendered the field as "13", and the browser threw away
  // the "." before the next digit arrived. Pixels never showed the bug because
  // every value there is a whole number.
  const draftHoldsValue =
    draft !== null && toPx(Number(draft), unit, resolution) === valuePx;

  return (
    <input
      type="number"
      id={id}
      name={id}
      className={isOutOfRange ? styles.outOfRange : undefined}
      aria-invalid={isOutOfRange}
      // Snapped onto the step grid by `boundsFor`, which is what lets these
      // exist at all in a physical unit — see its comment. The spinner then
      // clamps rather than running off into negative sizes.
      min={Number.isFinite(bounds.min) ? bounds.min : undefined}
      max={Number.isFinite(bounds.max) ? bounds.max : undefined}
      step={isPx && pxStep !== undefined ? pxStep : stepFor(unit, scale)}
      value={draftHoldsValue ? (draft as string) : canonicalText}
      onChange={(e) => {
        setDraft(e.target.value);
        onChangePx(toPx(e.target.valueAsNumber, unit, resolution));
      }}
      // Drop back to the canonical formatting once editing is over.
      onBlur={() => setDraft(null)}
    />
  );
}

export default LengthInput;
