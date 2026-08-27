import React, { useCallback, useMemo, useState } from "react";
import { Checkbox } from "react-bootstrap";
import { pluralize, uncapitalize } from "@depmap/data-explorer-2";
import BarChart from "./BarChart";
import shouldUseLogScale from "./shouldUseLogScale";
import getCategoricalPreviewMode, {
  CategoricalPreviewMode,
  TRUNCATED_CATEGORY_COUNT,
} from "./getCategoricalPreviewMode";
import styles from "../../styles/AddColumnModal.scss";

interface Props {
  dataValues: (string | number | string[])[];
  xAxisTitle: string;
  hoverLabel: string;
  initiallyShowNulls: boolean;
  entityLabel?: string;
  // Override for the percentage denominator. When omitted, the total is
  // derived from dataValues.length. Callers can pass an unfiltered total
  // so percentages reflect "fraction of all entities" even when dataValues
  // has been scoped to a filtered subset.
  totalCount?: number;
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
  initiallyShowNulls,
  entityLabel = "",
  totalCount: totalCountProp = undefined,
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
  const [showNulls, setShowNulls] = useState(initiallyShowNulls);

  const nullCount = useMemo(() => {
    if (!dataValues) return 0;
    return dataValues.filter((v) => v === undefined || v === null).length;
  }, [dataValues]);

  const totalCount = totalCountProp ?? (dataValues ? dataValues.length : 0);

  const {
    plotData,
    valueToOriginal,
    naIndex,
    previewMode,
    distinctCount,
    valueCount,
  } = useMemo(() => {
    if (!dataValues) {
      return {
        plotData: { x: [] as string[], y: [] as number[] },
        valueToOriginal: new Map<string, string | number>(),
        naIndex: -1,
        previewMode: "plot" as CategoricalPreviewMode,
        distinctCount: 0,
        valueCount: 0,
      };
    }

    const countsByValue = new Map<string | number, number>();
    let numValues = 0;

    dataValues.flat().forEach((val: string | number | undefined) => {
      if (val !== undefined) {
        countsByValue.set(val, (countsByValue.get(val) ?? 0) + 1);
        numValues += 1;
      }
    });

    const mode = getCategoricalPreviewMode(countsByValue.size, numValues);

    if (mode === "omit") {
      // Skip building the plot entirely.
      return {
        plotData: { x: [] as string[], y: [] as number[] },
        valueToOriginal: new Map<string, string | number>(),
        naIndex: -1,
        previewMode: mode,
        distinctCount: countsByValue.size,
        valueCount: numValues,
      };
    }

    // Convert to array and sort by counts descending
    const sorted = Array.from(countsByValue.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    const hasNaBar = showNulls && nullCount > 0;

    // Keep the total number of bars at (or under) the limit, leaving room for
    // the N/A bar so toggling it can't push us over and bring back the range
    // slider.
    const entries =
      mode === "truncate"
        ? sorted.slice(0, TRUNCATED_CATEGORY_COUNT - (hasNaBar ? 1 : 0))
        : sorted;

    // Map string keys back to original values (preserves number vs string)
    const valToOrig = new Map<string, string | number>();
    entries.forEach(([value]) => {
      valToOrig.set(`${value}`, value);
    });

    const x = entries.map(([value]) => `${value}`);
    const y = entries.map(([, count]) => count);

    if (hasNaBar) {
      // Insert at the correct position to maintain descending sort order.
      const insertAt = y.findIndex((count) => count <= nullCount);
      const pos = insertAt === -1 ? y.length : insertAt;
      x.splice(pos, 0, "N/A");
      y.splice(pos, 0, nullCount);
    }

    return {
      plotData: { x, y },
      valueToOriginal: valToOrig,
      naIndex: hasNaBar ? x.indexOf("N/A") : -1,
      previewMode: mode,
      distinctCount: countsByValue.size,
      valueCount: numValues,
    };
  }, [dataValues, showNulls, nullCount]);

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

  const disabledIndices = useMemo(() => {
    return naIndex >= 0 ? new Set([naIndex]) : undefined;
  }, [naIndex]);

  const entity = entityLabel ? uncapitalize(entityLabel) : "value";
  const entities = entityLabel ? pluralize(entity) : "values";

  if (previewMode === "omit") {
    return (
      <div className={styles.CategoricalDataPreview}>
        <div className={styles.omittedPlot} data-preview-mode="omit">
          <p>
            <strong>{hoverLabel}</strong> has {distinctCount.toLocaleString()}{" "}
            distinct values across {valueCount.toLocaleString()} {entities}.
          </p>
          <p>
            Nearly every {entity} has its own value, so a distribution plot
            wouldn’t tell you anything. It has been omitted.
          </p>
          {withFilter && (
            <p>
              Enter the value you want directly instead of picking it from a
              plot.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.CategoricalDataPreview}
      data-preview-mode={previewMode}
    >
      <div className={styles.barChartContainer}>
        <BarChart
          data={plotData}
          xAxisTitle={xAxisTitle}
          hoverLabel={hoverLabel}
          entityLabel={entityLabel}
          totalCount={totalCount}
          useLogScale={useLogScale}
          disabledIndices={disabledIndices}
          selectedPoints={withFilter ? selectedPoints : undefined}
          selectionMode={withFilter ? selectionMode : undefined}
          onSelect={withFilter ? handleSelect : undefined}
        />
      </div>
      {previewMode === "truncate" && (
        <div className={styles.truncationNote}>
          Showing the {TRUNCATED_CATEGORY_COUNT} most common of{" "}
          {distinctCount.toLocaleString()} values. There are too many to browse,
          so this window is fixed.
          {withFilter && (
            <>
              <br />
              To use a value that isn’t shown, enter it directly instead of
              picking it from the plot.
            </>
          )}
        </div>
      )}
      {nullCount > 0 && (
        <Checkbox
          className={styles.showNulls}
          checked={showNulls}
          onChange={() => setShowNulls(!showNulls)}
        >
          Show N/A values
        </Checkbox>
      )}
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
