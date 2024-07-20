import React from "react";

import styles from "src/common/styles/styled_meter.scss";

interface Colors {
  optimum: string;
  subOptimum: string;
  subSubOptimum: string;
}

interface OptionalStyles {
  width: string | number;
  backgroundColor: string;
  barColor: string | Colors;
  labelColor?: string;
}

interface Props {
  value: number;
  min?: number | string;
  max?: number | string;
  low?: number;
  high?: number;
  optimum?: number;

  style?: Partial<OptionalStyles>;

  showLabel?: boolean;

  percentage?: boolean;
  /**
   * If showLabel is true, set the label number to `toFixed` decimal places
   * Cannot be used with toFixed
   */
  toFixed?: number;

  /**
   * If showLabel is true, set the label number to `toPrecision` sig figs
   * Cannot be used with toFixed
   */
  toPrecision?: number;

  /* Space-separated list of extra class names */
  extraClassNames?: string;
}

const StyledMeter = ({
  value,
  min = undefined,
  max = undefined,
  low = undefined,
  high = undefined,
  optimum = undefined,
  style = undefined,
  showLabel = false,
  percentage = false,
  toFixed = 1,
  toPrecision = 3,
  extraClassNames = "",
}: Props) => {
  const additionalStyles: Record<string, any> = {};
  if (style) {
    if (style.width) {
      additionalStyles.width = style.width;
    }
    if (style.backgroundColor) {
      additionalStyles["--background-color"] = style.backgroundColor;
    }
    if (style.barColor) {
      if (typeof style.barColor === "string") {
        additionalStyles["--optimum-bar-color"] = style.barColor;
        additionalStyles["--sub-optimum-bar-color"] = style.barColor;
        additionalStyles["--sub-sub-optimum-bar-color"] = style.barColor;
      } else {
        additionalStyles["--optimum-bar-color"] = style.barColor.optimum;
        additionalStyles["--sub-optimum-bar-color"] = style.barColor.subOptimum;
        additionalStyles["--sub-sub-optimum-bar-color"] =
          style.barColor.subSubOptimum;
      }
    }
  }

  const labelStyles: Record<string, any> = {};
  if (showLabel && style && style.labelColor) {
    labelStyles["--label-color"] = style.labelColor;
  }

  const labelValue = percentage ? value * 100 : value;
  let label = labelValue.toPrecision(3);
  if (showLabel) {
    if (toFixed != null) {
      label = labelValue.toFixed(toFixed);
    } else if (toPrecision != null) {
      label = labelValue.toPrecision(toPrecision);
    }

    if (percentage) {
      label += "%";
    }
  }

  return (
    <span className={styles.container}>
      <meter
        className={`${styles.meter} ${extraClassNames}`}
        value={value}
        min={min}
        max={max}
        low={low}
        high={high}
        optimum={optimum}
        style={additionalStyles}
      />
      {showLabel && (
        <span className={styles.label} style={labelStyles}>
          {label}
        </span>
      )}
    </span>
  );
};

export default StyledMeter;
