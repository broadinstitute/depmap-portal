import { useCallback } from "react";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";
import compoundPagePromptForSelectionFromContext from "../../compoundPagePromptForSelectionFromContext";
import { useDeprecatedDataExplorerApi } from "@depmap/data-explorer-2";

function useDoseCurvesSelectionHandlers(
  selectedModelIds: Set<string>,
  selectedTableRows: Set<string>,
  setSelectedModelIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setSelectedTableRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  deApi: ReturnType<typeof useDeprecatedDataExplorerApi>,
  setShowUnselectedLines: (value: React.SetStateAction<boolean>) => void
) {
  const handleClickCurve = useCallback(
    (modelId: string) => {
      setSelectedModelIds((xs) => {
        const ys = new Set(xs);
        if (!xs?.has(modelId)) ys.add(modelId);
        selectedTableRows.forEach((rowId: string) => {
          if (!ys.has(rowId)) ys.add(rowId);
        });
        setSelectedTableRows(ys);
        return ys;
      });
    },
    [selectedTableRows]
  );

  const handleChangeTableSelection = useCallback(
    (selections: string[]) => {
      setSelectedTableRows((xs) => {
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
        setSelectedModelIds(ys);
        return ys;
      });
    },
    [selectedModelIds, setSelectedModelIds, setSelectedTableRows]
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
    handleClickCurve,
    handleChangeTableSelection,
    handleClickSaveSelectionAsContext,
    handleSetSelectionFromContext,
    handleClearSelection,
  };
}

export default useDoseCurvesSelectionHandlers;
