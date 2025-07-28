import { useCallback, useMemo } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { CompoundDoseCurveData, DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import compoundPagePromptForSelectionFromContext from "../../compoundPagePromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { TableFormattedData } from "src/compound/types";

function useDoseCurvesSelectionHandlers(
  doseCurveData: CompoundDoseCurveData | null,
  tableData: TableFormattedData | null,
  selectedModelIds: Set<string>,
  selectedTableRows: Set<string>,
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  handleShowUnselectedLinesOnSelectionsCleared: () => void,
  handleSetSelectedTableRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  handleSetSelectedPlotModelIds: React.Dispatch<
    React.SetStateAction<Set<string>>
  >
) {
  // Handlers
  const handleClickCurve = useCallback(
    (modelId: string) => {
      if (doseCurveData) {
        handleSetSelectedPlotModelIds((xs) => {
          const ys = new Set(xs);
          if (!xs?.has(modelId)) ys.add(modelId);
          selectedTableRows.forEach((rowId: string) => {
            if (!ys.has(rowId)) ys.add(rowId);
          });
          handleSetSelectedTableRows(ys);
          return ys;
        });
      }
    },
    [
      doseCurveData,
      selectedTableRows,
      handleSetSelectedTableRows,
      handleSetSelectedPlotModelIds,
    ]
  );

  const handleChangeSelection = useCallback(
    (selections: string[]) => {
      if (doseCurveData) {
        handleSetSelectedTableRows((xs) => {
          let unselectedId: string | undefined;
          const ys = new Set(xs);

          if (selections.length < xs.size) {
            unselectedId = [...xs].find((x) => !selections.includes(x));
            if (unselectedId !== undefined) {
              ys.delete(unselectedId);
            }
          } else {
            const newSelectedId = selections.filter(
              (x) => ![...xs].includes(x)
            )[0];
            ys.add(newSelectedId);
          }

          selectedModelIds.forEach((curveId: string) => {
            if (unselectedId && curveId !== unselectedId && !ys.has(curveId)) {
              ys.add(curveId);
            }
          });
          handleSetSelectedPlotModelIds(ys);
          return ys;
        });
      }
    },
    [
      doseCurveData,
      selectedModelIds,
      handleSetSelectedTableRows,
      handleSetSelectedPlotModelIds,
    ]
  );

  const handleClickSaveSelectionAsContext = useCallback(() => {
    const labels = [...selectedModelIds];
    const context = {
      name: defaultContextName(selectedModelIds.size),
      context_type: "depmap_model",
      expr: { in: [{ var: "entity_label" }, labels] },
    };
    saveNewContext(context as DataExplorerContext);
  }, [selectedModelIds]);

  const displayNameModelIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (tableData) {
      tableData.forEach((row) => {
        map.set(row.modelId, row.cellLine);
      });
    }
    return map;
  }, [tableData]);

  // Get the selected cell line name labels for display in the Plot Selections panel.
  const selectedLabels = useMemo(() => {
    const displayNames: string[] = [];
    [...selectedModelIds].forEach((modelId: string) => {
      const displayName = displayNameModelIdMap.get(modelId);
      if (displayName) {
        displayNames.push(displayName);
      }
    });
    return displayNames;
  }, [selectedModelIds, displayNameModelIdMap]);

  const handleSetSelectionFromContext = useCallback(async () => {
    const allLabels = new Set(
      doseCurveData?.curve_params.map((curveParam) => curveParam.id!)
    );
    const labels = await compoundPagePromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) return;
    handleSetSelectedPlotModelIds(labels);
    handleSetSelectedTableRows(labels);
  }, [
    doseCurveData,
    deApi,
    handleSetSelectedTableRows,
    handleSetSelectedPlotModelIds,
  ]);

  const handleClearSelection = useCallback(() => {
    handleSetSelectedPlotModelIds(new Set([]));
    handleSetSelectedTableRows(new Set([]));
    handleShowUnselectedLinesOnSelectionsCleared();
  }, [
    handleShowUnselectedLinesOnSelectionsCleared,
    handleSetSelectedPlotModelIds,
    handleSetSelectedTableRows,
  ]);

  return {
    selectedModelIds,
    selectedTableRows,
    selectedLabels,
    handleClickCurve,
    handleChangeSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  };
}

export default useDoseCurvesSelectionHandlers;
