import React, { useCallback, useMemo, useState } from "react";
import { useDataExplorerSettings } from "@depmap/data-explorer-2";
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
  selectionMask?: boolean[];
}

function CategoricalDataPreview({
  dataValues,
  xAxisTitle,
  hoverLabel,
  getCategoricalFilterProps = undefined,
  selectionMask = undefined,
}: Props) {
  const settings = useDataExplorerSettings();
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
      return { x: [], ySelected: [], yUnselected: [] };
    }

    const countsByValue = new Map<
      string | number,
      { selected: number; unselected: number }
    >();

    dataValues.flat().forEach((val, idx) => {
      if (val !== undefined) {
        const current = countsByValue.get(val) || {
          selected: 0,
          unselected: 0,
        };
        if (selectionMask?.[idx]) {
          current.selected++;
        } else {
          current.unselected++;
        }
        countsByValue.set(val, current);
      }
    });

    const entries = Array.from(countsByValue.entries()).sort((a, b) => {
      return (
        b[1].selected + b[1].unselected - (a[1].selected + a[1].unselected)
      );
    });

    return {
      x: entries.map(([value]) => value),
      ySelected: entries.map(([, counts]) => counts.selected),
      yUnselected: entries.map(([, counts]) => counts.unselected),
    };
  }, [dataValues, selectionMask]);

  const groupedData = useMemo(() => {
    if (!selectionMask) {
      return [
        {
          y: plotData.yUnselected,
          name: "count",
          color: "#1f77b4",
        },
      ];
    }

    return [
      {
        y: plotData.ySelected,
        name: "Selected",
        color: "#1f77b4",
      },
      {
        y: plotData.yUnselected,
        name: "Unselected",
        color: settings.plotStyles.palette.other,
      },
    ];
  }, [plotData, selectionMask, settings.plotStyles]);

  const useLogScale = useMemo(() => {
    return shouldUseLogScale([...plotData.ySelected, ...plotData.yUnselected]);
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
    <div>
      <BarChart
        x={plotData.x}
        groupedData={groupedData}
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
