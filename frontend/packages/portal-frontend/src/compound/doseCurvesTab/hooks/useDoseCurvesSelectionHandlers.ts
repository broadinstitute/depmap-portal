import { useCallback, useMemo, useState } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { CompoundDoseCurveData, DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import doseCurvesPromptForSelectionFromContext from "../../doseCurvesPromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { TableFormattedData } from "src/compound/types";

function useDoseCurvesSelectionHandlers(
  doseCurveData: CompoundDoseCurveData | null,
  tableData: TableFormattedData | null,
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  handleShowUnselectedLinesOnSelectionsCleared: () => void
) {
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  // Handlers
  const handleClickCurve = useCallback(
    (modelId: string) => {
      if (doseCurveData) {
        setSelectedModelIds((xs) => {
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

          selectedModelIds.forEach((curveId: string) => {
            if (unselectedId && curveId !== unselectedId && !ys.has(curveId)) {
              ys.add(curveId);
            }
          });
          setSelectedModelIds(ys);
          return ys;
        });
      }
    },
    [doseCurveData, selectedModelIds]
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
    const labels = await doseCurvesPromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) return;
    setSelectedModelIds(labels);
    setSelectedTableRows(labels);
  }, [doseCurveData, deApi]);

  const handleClearSelection = useCallback(() => {
    setSelectedModelIds(new Set([]));
    setSelectedTableRows(new Set([]));
    handleShowUnselectedLinesOnSelectionsCleared();
  }, [handleShowUnselectedLinesOnSelectionsCleared]);

  const sortedTableData: TableFormattedData = useMemo(() => {
    if (!tableData) return [];
    if (selectedTableRows.size === 0) return tableData;
    // Selected rows at the top, in order of selection, then the rest in original order
    const selectedIds = Array.from(selectedTableRows);
    const selected = selectedIds
      .map((id) => tableData.find((row) => row.modelId === id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const unselected = tableData.filter(
      (row) => !selectedTableRows.has(row.modelId)
    );
    return [...selected, ...unselected];
  }, [selectedTableRows, tableData]);

  return {
    selectedModelIds,
    setselectedModelIds: setSelectedModelIds,
    selectedTableRows,
    selectedLabels,
    setSelectedTableRows,
    handleClickCurve,
    handleChangeSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    sortedTableData,
  };
}

export default useDoseCurvesSelectionHandlers;
