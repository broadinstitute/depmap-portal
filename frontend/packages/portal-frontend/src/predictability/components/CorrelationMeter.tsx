import React from "react";
import { getCorrelationColor } from "@depmap/utils";

import style from "src/predictability/styles/correlation_meter.scss";

interface Props {
  correlation: number;
  showLabel?: boolean;
  useGradedColorScheme?: boolean;
  customWidth?: string;
  // When set, the bar always runs left-to-right from 0 to abs(correlation)
  // (so magnitudes are easy to compare by eye regardless of sign), rather
  // than growing left or right from a center divider. The color is still
  // derived from the signed correlation, so positive/negative is still
  // distinguishable by color alone.
  rightSideOnly?: boolean;
}
const CorrelationMeter = ({
  correlation,
  showLabel = true,
  useGradedColorScheme = false,
  customWidth = undefined,
  rightSideOnly = false,
}: Props) => {
  const className = correlation >= 0 ? "positive" : "negative";
  const magnitude = Math.abs(correlation);

  return (
    <span
      className={style.container}
      style={
        customWidth
          ? ({ "--width": customWidth } as React.CSSProperties)
          : undefined
      }
    >
      <meter
        className={style.meter}
        min={rightSideOnly ? 0 : -1}
        max={1}
        value={rightSideOnly ? magnitude : correlation}
      />
      <div
        className={`${style["meter-bar"]} ${
          rightSideOnly ? style.fullBar : style[className]
        }`}
        style={
          useGradedColorScheme
            ? ({
                width: `${magnitude * (rightSideOnly ? 100 : 50)}%`,
                "--bar-color": getCorrelationColor(correlation),
              } as React.CSSProperties)
            : { width: `${magnitude * (rightSideOnly ? 100 : 50)}%` }
        }
      />
      {showLabel && (
        <span
          className={`${style.label} ${
            rightSideOnly ? "" : style[`${className}-label`]
          }`}
          aria-hidden
        >
          {correlation.toFixed(2)}
        </span>
      )}
      {!rightSideOnly && <div className={style["vertical-bar"]} />}
    </span>
  );
};

export default CorrelationMeter;
