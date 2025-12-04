import React from "react";
import { getCorrelationColor } from "src/compound/utils";

import style from "src/predictability/styles/correlation_meter.scss";

interface Props {
  correlation: number;
  showLabel?: boolean;
  useGradedColorScheme?: boolean;
  customWidth?: string;
}
const CorrelationMeter = ({
  correlation,
  showLabel = true,
  useGradedColorScheme = false,
  customWidth = undefined,
}: Props) => {
  const className = correlation >= 0 ? "positive" : "negative";

  return (
    <span
      className={style.container}
      style={
        customWidth
          ? ({ "--width": customWidth } as React.CSSProperties)
          : undefined
      }
    >
      <meter className={style.meter} min={-1} max={1} value={correlation} />
      <div
        className={`${style["meter-bar"]} ${style[className]}`}
        style={
          useGradedColorScheme
            ? ({
                width: `${Math.abs(correlation) * 50}%`,
                "--bar-color": getCorrelationColor(correlation),
              } as React.CSSProperties)
            : { width: `${Math.abs(correlation) * 50}%` }
        }
      />
      {showLabel && (
        <span
          className={`${style.label} ${style[`${className}-label`]}`}
          aria-hidden
        >
          {correlation.toFixed(2)}
        </span>
      )}
      <div className={style["vertical-bar"]} />
    </span>
  );
};

export default CorrelationMeter;
