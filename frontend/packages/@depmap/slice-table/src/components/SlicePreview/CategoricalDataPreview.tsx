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

  const plotData = useMemo(() => {
    if (!dataValues) {
      return { x: [] as string[], y: [] as number[] };
    }

    const countsByValue = new Map<string, number>();

    dataValues.flat().forEach((val: string | number | undefined) => {
      // TODO: Add an option to show NAs instead of always ignoring them.
      if (val !== undefined) {
        const stringVal = `${val}`;
        countsByValue.set(stringVal, (countsByValue.get(stringVal) ?? 0) + 1);
      }
    });

    // Convert to array and sort by counts descending
    const entries = Array.from(countsByValue.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    return {
      x: entries.map(([value]) => value),
      y: entries.map(([, count]) => count),
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
      const val = plotData.x[i];
      if (selectedValues.has(val)) {
        points.add(i);
      }
    }

    return points;
  }, [withFilter, selectedValues, plotData.x]);

  const handleSelect = useCallback(
    (pointIndices: number[]) => {
      if (!onChangeSelectedValues) return;

      const nextSelectedValues = new Set<string | number>();

      pointIndices.forEach((i: number) => {
        nextSelectedValues.add(plotData.x[i]);
      });

      setSelectedValues(nextSelectedValues);
      onChangeSelectedValues(nextSelectedValues);
    },
    [onChangeSelectedValues, plotData]
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
