import React, { useCallback, useMemo, useState } from "react";
import BarChart from "./BarChart";
import shouldUseLogScale from "./shouldUseLogScale";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  dataValues: (string | number | string[])[];
  xAxisTitle: string;
  hoverLabel: string;
  getCategoricalFilterProps?: () => {
    selectionMode: "single" | "multiple";
    initialSelectedValues: Set<string | number>;
    onChangeSelectedValues: (nextSelectedValues: Set<string | number>) => void;
  };
}

function CategoricalDataPreview({
  dataValues,
  xAxisTitle,
  hoverLabel,
  getCategoricalFilterProps = undefined,
}: Props) {
  const filterProps = getCategoricalFilterProps?.();
  const withFilter = !!filterProps;

  const {
    selectionMode = "single",
    initialSelectedValues = new Set<string | number>(),
    onChangeSelectedValues,
  } = filterProps || {};

  const [selectedValues, setSelectedValues] = useState(initialSelectedValues);

  const { plotData, valueToOriginal } = useMemo(() => {
    if (!dataValues) {
      return {
        plotData: { x: [] as string[], y: [] as number[] },
        valueToOriginal: new Map<string, string | number>(),
      };
    }

    const countsByValue = new Map<string | number, number>();

    dataValues.flat().forEach((val: string | number | undefined) => {
      // TODO: Add an option to show NAs instead of always ignoring them.
      if (val !== undefined) {
        countsByValue.set(val, (countsByValue.get(val) ?? 0) + 1);
      }
    });

    // Convert to array and sort by counts descending
    const entries = Array.from(countsByValue.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Map string keys back to original values (preserves number vs string)
    const valToOrig = new Map<string, string | number>();
    entries.forEach(([value]) => {
      valToOrig.set(`${value}`, value);
    });

    return {
      plotData: {
        x: entries.map(([value]) => `${value}`), // strings for Plotly
        y: entries.map(([, count]) => count),
      },
      valueToOriginal: valToOrig,
    };
  }, [dataValues]);

  const useLogScale = useMemo(() => {
    return shouldUseLogScale(plotData.y);
  }, [plotData]);

  const selectedPoints = useMemo(() => {
    if (!withFilter) {
      return undefined;
    }

    const points = new Set<number>();
    for (let i = 0; i < plotData.x.length; i += 1) {
      const stringVal = plotData.x[i];
      const originalVal = valueToOriginal.get(stringVal);
      if (originalVal !== undefined && selectedValues.has(originalVal)) {
        points.add(i);
      }
    }

    return points;
  }, [withFilter, selectedValues, plotData.x, valueToOriginal]);

  const handleSelect = useCallback(
    (pointIndices: number[]) => {
      if (!onChangeSelectedValues) return;

      const nextSelectedValues = new Set<string | number>();

      pointIndices.forEach((i: number) => {
        const originalVal = valueToOriginal.get(plotData.x[i]);
        if (originalVal !== undefined) {
          nextSelectedValues.add(originalVal);
        }
      });

      setSelectedValues(nextSelectedValues);
      onChangeSelectedValues(nextSelectedValues);
    },
    [onChangeSelectedValues, plotData.x, valueToOriginal]
  );

  return (
    <div className={styles.CategoricalDataPreview}>
      <BarChart
        data={plotData}
        xAxisTitle={xAxisTitle}
        hoverLabel={hoverLabel}
        useLogScale={useLogScale}
        selectedPoints={withFilter ? selectedPoints : undefined}
        selectionMode={withFilter ? selectionMode : undefined}
        onSelect={withFilter ? handleSelect : undefined}
      />
      {withFilter && (
        <div className={styles.helpText}>
          Click a bar to select a value.
          {selectionMode === "multiple" && (
            <>
              <br />
              Hold shift to select multiple, or use the Box Select or Lasso
              Select tools.
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoricalDataPreview;
