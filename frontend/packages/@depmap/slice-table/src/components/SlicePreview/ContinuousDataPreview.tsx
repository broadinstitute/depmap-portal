import React, { useMemo, useState } from "react";
import {
  DensityPlot,
  LEGEND_ALL,
  useDataExplorerSettings,
} from "@depmap/data-explorer-2";
import ContinuousFilter from "./ContinuousFilter";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  values: number[];
  hoverText: string[];
  xAxisTitle: string;
  getContinuousFilterProps?: () => {
    hasFixedMin: boolean;
    hasFixedMax: boolean;
    minInclusive: boolean;
    maxInclusive: boolean;
    initialRange: [number | undefined, number | undefined];
    onChangeRange: (nextRange: [number, number]) => void;
    filterHelpText?: string;
  };
}

function getRange(values?: number[]) {
  let min = Infinity;
  let max = -Infinity;

  if (values) {
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];

      if (value !== null && value !== undefined) {
        if (value < min) {
          min = value;
        }

        if (value > max) {
          max = value;
        }
      }
    }
  }

  return [min, max];
}

function ContinuousDataPreview({
  values,
  hoverText,
  xAxisTitle,
  getContinuousFilterProps = undefined,
}: Props) {
  const filterProps = getContinuousFilterProps?.();
  const withFilter = !!filterProps;

  const {
    hasFixedMin = false,
    hasFixedMax = false,
    minInclusive = true,
    maxInclusive = true,
    initialRange = [undefined, undefined],
    onChangeRange,
    filterHelpText = "",
  } = filterProps || {};
  const plotData = useMemo(() => {
    if (!values) {
      return { x: [] };
    }

    return {
      x: values,
      xLabel: xAxisTitle,
      hoverText,
      y: null,
      yLabel: null,
      color1: null,
      color2: null,
      catColorData: null,
      contColorData: null,
    };
  }, [values, hoverText, xAxisTitle]);

  const validInitialRange = useMemo(() => {
    if (!withFilter) return null;

    let [min, max] = initialRange;
    const fullRange = getRange(plotData.x || []);

    if (min == null || min < fullRange[0] || min > fullRange[1]) {
      min = fullRange[0];
    }

    if (max == null || max > fullRange[1] || max < fullRange[0]) {
      max = fullRange[1];
    }

    if (min === max) {
      // WORKAROUND: Apply a small delta so the plot won't freak out.
      // (This can really only happen with pseudo-binary values).
      if (initialRange[0] === undefined) {
        min = max;
        max += 0.1;
      } else {
        max = min;
        min -= 0.1;
      }
    }

    return [min, max] as [number, number];
  }, [withFilter, initialRange, plotData]);

  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(
    validInitialRange
  );

  const isSingleValueMode = hasFixedMin && hasFixedMax;

  const selectedPoints = useMemo(() => {
    if (!withFilter || !plotData || !selectedRange) {
      return undefined;
    }

    const ps = new Set<number>();

    if (isSingleValueMode) {
      for (let i = 0; i < plotData.x.length; i += 1) {
        if (plotData.x[i] === selectedRange[0]) {
          ps.add(i);
        }
      }
    } else {
      const [min, max] = selectedRange;

      for (let i = 0; i < plotData.x.length; i += 1) {
        const x = plotData.x[i];
        if (
          (minInclusive ? x >= min : x > min) &&
          (maxInclusive ? x <= max : x < max)
        ) {
          ps.add(i);
        }
      }
    }

    return ps;
  }, [
    withFilter,
    selectedRange,
    minInclusive,
    maxInclusive,
    plotData,
    isSingleValueMode,
  ]);

  const handleClickPoint = (pointIndex: number) => {
    if (isSingleValueMode && onChangeRange) {
      const minMax = plotData.x[pointIndex];
      const nextRange = [minMax, minMax] as [number, number];

      setSelectedRange(nextRange);
      onChangeRange(nextRange);
    }
  };

  const settings = useDataExplorerSettings();
  const plotStyles = {
    ...settings.plotStyles,
    palette: { ...settings.plotStyles.palette, all: "#1f77b4" },
  };

  let helpText = filterHelpText;

  if (withFilter && !helpText) {
    helpText = isSingleValueMode
      ? "Click a point to select all equivalent values."
      : "Drag the window below to adjust the threshold.";
  }

  const containerStyle = withFilter
    ? { minHeight: !isSingleValueMode ? 610 : 500 }
    : undefined;

  return (
    <div style={containerStyle}>
      <DensityPlot
        height={480}
        data={plotData}
        xKey="x"
        hoverTextKey="hoverText"
        colorMap={new Map([[LEGEND_ALL, plotStyles.palette.all]])}
        legendDisplayNames={{ Selected: "Selected", Unselected: "Unselected" }}
        selectedPoints={selectedPoints}
        onClickPoint={withFilter ? handleClickPoint : undefined}
        useSemiOpaqueViolins
        {...plotStyles}
      />
      {withFilter && helpText && (
        <div className={styles.helpText}>{helpText}</div>
      )}
      {withFilter && !isSingleValueMode && validInitialRange && onChangeRange && (
        <div className={styles.continuousFilterContainer}>
          <ContinuousFilter
            data={plotData}
            colorMap={new Map([[LEGEND_ALL, plotStyles.palette.all]])}
            hasFixedMin={hasFixedMin}
            hasFixedMax={hasFixedMax}
            initialRange={validInitialRange}
            onChangeRange={(nextRange) => {
              let [min, max] = nextRange;

              if (min !== validInitialRange[0]) {
                min = +min.toFixed(3);
              }

              if (max !== validInitialRange[1]) {
                max = +max.toFixed(3);
              }

              setSelectedRange([min, max]);
              onChangeRange([min, max]);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ContinuousDataPreview;
