import { useCallback } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import compoundPagePromptForSelectionFromContext from "../../compoundPagePromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";

function useHeatmapSelectionHandlers(
  selectedModelIds: Set<string>,
  setSelectedModelIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setSelectedTableRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  setShowUnselectedLines: (value: React.SetStateAction<boolean>) => void
) {
  const handleChangeTableSelection = useCallback(
    (selections: string[]) => {
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
    },
    [selectedModelIds, setSelectedModelIds, setSelectedTableRows]
  );

  const handleSetSelectedPlotModels = (models: Set<string>) => {
    setSelectedModelIds((prev) => {
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

  const handleSetSelectionFromContext = useCallback(async () => {
    const allLabels = new Set(selectedModelIds);
    const labels = await compoundPagePromptForSelectionFromContext(
      deApi,
      allLabels
    );
    if (labels === null) {
      return;
    }
    setSelectedModelIds(labels);
    setSelectedTableRows(labels);
  }, [deApi, setSelectedModelIds, setSelectedTableRows, selectedModelIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedModelIds(new Set([]));
    setSelectedTableRows(new Set([]));
    setShowUnselectedLines(true);
  }, [setShowUnselectedLines, setSelectedTableRows, setSelectedModelIds]);

  return {
    handleSetSelectedPlotModels,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  };
}

export default useHeatmapSelectionHandlers;
