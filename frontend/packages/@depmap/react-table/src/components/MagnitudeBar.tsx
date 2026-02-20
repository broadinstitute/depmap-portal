import React from "react";
import styles from "../styles/ReactTable.scss";

type MagnitudeBarProps = {
  value: number;
  min: number;
  max: number;
  // Optional formatted string for display. When provided, this is shown
  // instead of the raw numeric value. The raw `value` is still used for
  // bar width calculations.
  displayValue?: string;
};

const NEGATIVE_COLOR = "#E53935"; // Red
const POSITIVE_COLOR = "#1E88E5"; // Blue

/**
 * Renders a numeric value with a semi-transparent bar behind it.
 * Uses a diverging scale with zero ALWAYS at the center (50%):
 * - Negative values show a red bar growing LEFT from center toward left edge
 * - Positive values show a blue bar growing RIGHT from center toward right edge
 */
export function MagnitudeBar({
  value,
  min,
  max,
  displayValue = undefined,
}: MagnitudeBarProps) {
  // Bar width as percentage of half the cell (0-50%)
  let barWidthPercent = 0;
  let isNegative = false;

  if (value < 0 && min < 0) {
    // Negative: percentage of the left half (0-50%)
    barWidthPercent = (Math.abs(value) / Math.abs(min)) * 50;
    isNegative = true;
  } else if (value > 0 && max > 0) {
    // Positive: percentage of the right half (0-50%)
    barWidthPercent = (value / max) * 50;
  }

  return (
    <div className={styles.magnitudeBarCell}>
      {/* Negative bar: grows left from center (50%) */}
      {isNegative && (
        <div
          className={styles.magnitudeBar}
          style={{
            left: `${50 - barWidthPercent}%`,
            width: `${barWidthPercent}%`,
            backgroundColor: NEGATIVE_COLOR,
          }}
        />
      )}
      {/* Positive bar: grows right from center (50%) */}
      {!isNegative && value > 0 && (
        <div
          className={styles.magnitudeBar}
          style={{
            left: "50%",
            width: `${barWidthPercent}%`,
            backgroundColor: POSITIVE_COLOR,
          }}
        />
      )}
      <span className={styles.magnitudeBarValue}>{displayValue ?? value}</span>
    </div>
  );
}
