import React from "react";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import {
  ceil,
  floor,
  LegendKey,
  precision,
} from "src/data-explorer-2/components/plot/prototype/plotUtils";

function GeneDepLegendLabels({
  colorMap,
  continuousBins,
  legendKeysWithNoData,
}: any) {
  const getDisplayName = (category: LegendKey, contBins: any) => {
    const [binStart, binEnd] = contBins[category];
    const p = precision(Math.abs(binEnd - binStart));

    if (!Number.isFinite(binStart) || !Number.isFinite(binEnd)) {
      return "No data";
    }

    return [ceil(binStart, p), floor(binEnd, p)];
  };
  const LegendLabel = (category: any, bins: any) => {
    const name = getDisplayName(category, bins);
    /* eslint-disable no-nested-ternary */
    const nameElement =
      typeof name === "string" ? (
        <p>{name}</p>
      ) : (
        <p>
          {name[0] < 0 && name[1] > 0
            ? 0
            : name[0] > 0 && name[1] > 0
            ? name[1]
            : name[0]}
        </p>
      );
    /* eslint-enable no-nested-ternary */

    return nameElement;
  };
  return (
    <div className={styles.LegendLabels}>
      {Reflect.ownKeys(colorMap || {})
        .filter(
          (category: any) =>
            !legendKeysWithNoData || !legendKeysWithNoData.has(category)
        )
        .map((category: any) => (
          <div key={category.toString()}>
            <button
              type="button"
              style={{
                opacity: 1.0,
              }}
            >
              <div className={styles.legendColumn}>
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: colorMap[category] }}
                />

                {LegendLabel(category, continuousBins)}
              </div>
            </button>
          </div>
        ))}
    </div>
  );
}

function ScatterPlotPlotLegend({
  legendTitle,
  colorMap,
  continuousBins,
  legendKeysWithNoData,
  disabled = false,
}: any) {
  return (
    <div className={styles.legendContainer}>
      <div className={disabled ? styles.legendDisabled : styles.legend}>
        <div className={styles.colorDimensionLabels}>
          <p>{legendTitle}</p>
        </div>
        <GeneDepLegendLabels
          colorMap={colorMap}
          continuousBins={continuousBins}
          legendKeysWithNoData={legendKeysWithNoData}
        />
      </div>
    </div>
  );
}

export default ScatterPlotPlotLegend;
