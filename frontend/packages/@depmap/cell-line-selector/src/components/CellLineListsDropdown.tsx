import React, { useCallback, useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import {
  ContextSelectorV2,
  fetchContext,
  isNegatedContext,
  negateContext,
  persistLegacyListAsContext,
  PlotConfigSelect,
} from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  getSelectedCellLineListName,
  setSelectedCellLineListName,
} from "@depmap/utils";
import { CustomList } from "./ListStorage";

type Props = {
  defaultNone?: boolean;
  onListSelect: (cellLineList: CustomList) => void;
};

const getSelectedContextHash = () => {
  return window.localStorage.getItem("model_context_to_highlight") || null;
};

const setSelectedContextHash = (hash: string | null, negated: boolean) => {
  window.localStorage.setItem(
    "model_context_to_highlight",
    `${hash && negated ? "not_" : ""}${hash || ""}`
  );
};

function CellLineListsDropdown({
  // `defaultNone` means this component should neither read nor write the value
  // that determines how to highlight cell lines throughout the Portal. This
  // value was previously known as "selectedCellLineListName." The new
  // "model_context_to_highlight" fills a similar role.
  defaultNone = false,
  onListSelect,
}: Props) {
  const [isLoading, setIsLoading] = useState(!defaultNone);
  const [value, setValue] = useState<DataExplorerContextV2 | null>(null);

  const handleChange = useCallback(
    async (context: DataExplorerContextV2 | null, hash: string | null) => {
      setValue(context);
      const negated = isNegatedContext(context);

      if (!defaultNone) {
        setSelectedContextHash(hash, negated);
      }

      if (context && hash) {
        const result = await breadboxAPI.evaluateContext(context);
        const labels = result.ids;

        onListSelect({
          name: context.name,
          lines: new Set(labels),
          fromContext: { hash, negated },
        });
      } else {
        onListSelect({ name: "", lines: new Set() });
      }
    },
    [defaultNone, onListSelect]
  );

  useEffect(() => {
    if (value || defaultNone) {
      return;
    }

    (async () => {
      const selectedList = getSelectedCellLineListName();
      const selectedContextHash = getSelectedContextHash();

      if (selectedList && selectedList !== "None") {
        const [hash, context] = await persistLegacyListAsContext(selectedList);
        setSelectedCellLineListName("None");
        handleChange(context, hash);
      }

      if (selectedContextHash) {
        const hashWithoutPrefix = selectedContextHash.replace("not_", "");
        try {
          const context = (await fetchContext(
            hashWithoutPrefix
          )) as DataExplorerContextV2;

          handleChange(
            selectedContextHash.startsWith("not_")
              ? negateContext(context)
              : context,
            hashWithoutPrefix
          );
        } catch (e) {
          handleChange(null, null);
          window.console.error(e);
        }
      }

      setIsLoading(false);
    })();
  }, [value, defaultNone, handleChange]);

  const handleClickCreateContext = () => {
    DepMap.saveNewContext(
      { dimension_type: "depmap_model" },
      null,
      handleChange
    );
  };

  const handleClickSaveAsContext = () => {
    DepMap.saveNewContext(value!, null, setValue);
  };

  if (isLoading) {
    return (
      <PlotConfigSelect
        show
        enable
        isLoading
        placeholder="Loading..."
        label={null}
        value={null}
        options={[]}
        onChange={() => {}}
      />
    );
  }

  return (
    <ContextSelectorV2
      show
      enable
      value={value}
      dimension_type="depmap_model"
      onChange={handleChange}
      onClickCreateContext={handleClickCreateContext}
      onClickSaveAsContext={handleClickSaveAsContext}
    />
  );
}

// FIXME: Replace this component with ContextSelector. It only existed to ease
// the transition away from the the cell line lists that Cell Line Selector
// output. The following components should be updated:
// DataSlicer
// ElaraDataSlicer
// EntitySummary
// GeneCharacterizationPanel
// CellignerCellLinesForTumorsControlPanel
export default CellLineListsDropdown;
