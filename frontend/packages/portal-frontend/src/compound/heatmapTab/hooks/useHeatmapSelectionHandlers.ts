import { useCallback, useMemo, useState } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import doseCurvesPromptForSelectionFromContext from "../../doseCurvesPromptForSelectionFromContext";
import { sortBySelectedModel } from "../../utils";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { HeatmapFormattedData, TableFormattedData } from "../../types";

function useHeatmapSelectionHandlers(
  plotData: HeatmapFormattedData | null,
  tableData: TableFormattedData | null,
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  handleShowUnselectedLinesOnSelectionsCleared: () => void
) {
  const [selectedModelIds, setPlotSelectedModelIds] = useState<Set<string>>(
    new Set([])
  );
  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set([])
  );

  const handleChangeTableSelection = useCallback(
    (selections: string[]) => {
      if (plotData) {
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
          setPlotSelectedModelIds(ys);
          return ys;
        });
      }
    },
    [plotData, selectedModelIds]
  );

  const handleSetSelectedPlotModels = (models: Set<string>) => {
    setPlotSelectedModelIds((prev) => {
      const next = new Set(prev);
      models.forEach((id) => next.add(id));
      setSelectedTableRows((tablePrev) => {
        const tableNext = new Set(tablePrev);
        models.forEach((id) => tableNext.add(id));
        return tableNext;
      });
      return next;
    });
  };

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
    const allModelIds = Array.from(displayNameModelIdMap.keys());
    const allLabels = new Set(allModelIds);
    const labels = await doseCurvesPromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) return;
    setPlotSelectedModelIds(labels);
    setSelectedTableRows(labels);
  }, [deApi, selectedLabels]);

  const handleClearSelection = useCallback(() => {
    setPlotSelectedModelIds(new Set([]));
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
    selectedTableRows,
    selectedLabels,
    displayNameModelIdMap,
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
    sortedTableData,
  };
}

export default useHeatmapSelectionHandlers;
