import { useCallback, useMemo, useState } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import doseCurvesPromptForSelectionFromContext from "../doseCurvesPromptForSelectionFromContext";
import { sortBySelectedModel } from "../utils";
import { CompoundDoseCurveData, DoseTableRow } from "../types";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";

function useDoseCurvesSelectionHandlers(
  doseCurveData: CompoundDoseCurveData | null,
  tableData: DoseTableRow[],
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  handleShowUnselectedLinesOnSelectionsCleared: () => void
) {
  const [selectedCurves, setSelectedCurves] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  // Handlers
  const handleClickCurve = useCallback(
    (modelId: string) => {
      if (doseCurveData) {
        setSelectedCurves((xs) => {
          const ys = new Set(xs);
          if (!xs?.has(modelId)) ys.add(modelId);
          selectedTableRows.forEach((rowId: string) => {
            if (!ys.has(rowId)) ys.add(rowId);
          });
          setSelectedTableRows(ys);
          return ys;
        });
      }
    },
    [doseCurveData, selectedTableRows]
  );

  const handleChangeSelection = useCallback(
    (selections: string[]) => {
      if (doseCurveData) {
        setSelectedTableRows((xs) => {
          let unselectedId: string;
          const ys = new Set(xs);

          if (selections.length < xs.size) {
            unselectedId = [...xs].filter((x) => !selections.includes(x))[0];
            ys.delete(unselectedId);
          } else {
            const newSelectedId = selections.filter(
              (x) => ![...xs].includes(x)
            )[0];
            ys.add(newSelectedId);
          }

          selectedCurves.forEach((curveId: string) => {
            if (unselectedId && curveId !== unselectedId && !ys.has(curveId)) {
              ys.add(curveId);
            }
          });
          setSelectedCurves(ys);
          return ys;
        });
      }
    },
    [doseCurveData, selectedCurves]
  );

  const handleClickSaveSelectionAsContext = useCallback(() => {
    const labels = [...selectedCurves];
    const context = {
      name: defaultContextName(selectedCurves.size),
      context_type: "depmap_model",
      expr: { in: [{ var: "entity_label" }, labels] },
    };
    saveNewContext(context as DataExplorerContext);
  }, [selectedCurves]);

  const handleSetSelectionFromContext = useCallback(async () => {
    const allLabels = new Set(
      doseCurveData?.curve_params.map((curveParam) => curveParam.id!)
    );
    const labels = await doseCurvesPromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) return;
    setSelectedCurves(labels);
    setSelectedTableRows(labels);
  }, [doseCurveData, deApi]);

  const handleClearSelection = useCallback(() => {
    setSelectedCurves(new Set([]));
    setSelectedTableRows(new Set([]));
    handleShowUnselectedLinesOnSelectionsCleared();
  }, [handleShowUnselectedLinesOnSelectionsCleared]);

  // Memoized sorted table data
  const memoizedTableData = useMemo(() => {
    return selectedTableRows.size === 0
      ? tableData
      : sortBySelectedModel(tableData, selectedTableRows);
  }, [selectedTableRows, tableData]);

  return {
    selectedCurves,
    setSelectedCurves,
    selectedTableRows,
    setSelectedTableRows,
    handleClickCurve,
    handleChangeSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    memoizedTableData,
  };
}

export default useDoseCurvesSelectionHandlers;
