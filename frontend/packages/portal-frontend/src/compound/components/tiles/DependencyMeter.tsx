import React from "react";
import StyledMeter from "src/common/components/StyledMeter";
import styles from "../../styles/correlated_dependencies_tile.scss";

interface DependencyMeterProps {
  correlation: number;
}

export const DependencyMeter: React.FC<DependencyMeterProps> = ({
  correlation,
}) => {
  // given the correlation value, return the color within a range
  const getCorrelationColor = (val: number) => {
    // Ensure value between 0 and 1
    const value = Math.max(0, Math.min(1, val));

    // Ranges:
    // Light red - rgb(255, 200, 200)
    // Dark red -  rgb(150,   0,   0)
    const r = Math.round(255 - 105 * value);
    const g = Math.round(200 - 200 * value);
    const b = Math.round(200 - 200 * value);

    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className={styles.dependencyMeter}>
      <StyledMeter
        value={correlation}
        style={{ barColor: getCorrelationColor(correlation) }}
      />
    </div>
  );
};
