import { useCallback, useMemo } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import compoundPagePromptForSelectionFromContext from "../../compoundPagePromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";
import { HeatmapFormattedData, TableFormattedData } from "../../types";

function useHeatmapSelectionHandlers(
  plotData: HeatmapFormattedData | null,
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
  const handleChangeTableSelection = useCallback(
    (selections: string[]) => {
      if (plotData) {
        handleSetSelectedTableRows((xs) => {
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
          handleSetSelectedPlotModelIds(ys);
          return ys;
        });
      }
    },
    [
      plotData,
      selectedModelIds,
      handleSetSelectedPlotModelIds,
      handleSetSelectedTableRows,
    ]
  );

  const handleSetSelectedPlotModels = (models: Set<string>) => {
    handleSetSelectedPlotModelIds((prev) => {
      const next = new Set(prev);

      models.forEach((id) => {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });

      handleSetSelectedTableRows(() => {
        const tableNext = new Set(next);
        next.forEach((id) => tableNext.add(id));
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
    const labels = await compoundPagePromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) {
      return;
    }
    handleSetSelectedPlotModelIds(labels);
    handleSetSelectedTableRows(labels);
  }, [
    deApi,
    displayNameModelIdMap,
    handleSetSelectedPlotModelIds,
    handleSetSelectedTableRows,
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
    displayNameModelIdMap,
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  };
}

export default useHeatmapSelectionHandlers;
