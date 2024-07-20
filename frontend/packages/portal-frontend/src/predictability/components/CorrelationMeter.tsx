import React from "react";

import style from "src/predictability/styles/correlation_meter.scss";

interface Props {
  correlation: number;
}
const CorrelationMeter = (props: Props) => {
  const { correlation } = props;
  const className = correlation >= 0 ? "positive" : "negative";

  return (
    <span className={style.container}>
      <meter className={style.meter} min={-1} max={1} value={correlation} />
      <div
        className={`${style["meter-bar"]} ${style[className]}`}
        style={{ width: `${Math.abs(correlation) * 50}%` }}
      />
      <span
        className={`${style.label} ${style[`${className}-label`]}`}
        aria-hidden
      >
        {correlation.toFixed(2)}
      </span>
      <div className={style["vertical-bar"]} />
    </span>
  );
};

export default CorrelationMeter;
