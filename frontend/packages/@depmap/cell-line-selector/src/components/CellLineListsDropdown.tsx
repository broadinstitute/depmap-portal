import React, { useCallback, useEffect, useState } from "react";
import {
  ContextSelector,
  fetchContext,
  isNegatedContext,
  isV2Context,
  negateContext,
  persistLegacyListAsContext,
  PlotConfigSelect,
  useDataExplorerApi,
  useDeprecatedDataExplorerApi,
} from "@depmap/data-explorer-2";
import { DepMap, isElara } from "@depmap/globals";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import {
  getSelectedCellLineListName,
  setSelectedCellLineListName,
} from "@depmap/utils";
import { CustomList } from "./ListStorage";

type LegacyCellLineListsDropdownProps = {
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

const ContextEnabledDropdown = ({
  // `defaultNone` means this component should neither read nor write the value
  // that determines how to highlight cell lines throughout the Portal. This
  // value was previously known as "selectedCellLineListName." The new
  // "model_context_to_highlight" fills a similar role.
  defaultNone,
  onListSelect,
}: {
  defaultNone: boolean;
  onListSelect: LegacyCellLineListsDropdownProps["onListSelect"];
}) => {
  const api = useDataExplorerApi();
  const deprecatedApi = useDeprecatedDataExplorerApi();
  const [isLoading, setIsLoading] = useState(!defaultNone);
  const [value, setValue] = useState<DataExplorerContext | null>(null);

  const handleChange = useCallback(
    async (context: DataExplorerContext | null, hash: string | null) => {
      setValue(context);
      const negated = isNegatedContext(context);

      if (!defaultNone) {
        setSelectedContextHash(hash, negated);
      }

      if (context && hash) {
        let labels: string[] = [];

        if (isElara) {
          const result = await api.evaluateContext(
            (context as unknown) as DataExplorerContextV2
          );
          labels = result.labels;
        } else {
          labels = await deprecatedApi.evaluateLegacyContext(context);
        }

        onListSelect({
          name: context.name,
          lines: new Set(labels),
          fromContext: { hash, negated },
        });
      } else {
        onListSelect({ name: "", lines: new Set() });
      }
    },
    [api, deprecatedApi, defaultNone, onListSelect]
  );

  useEffect(() => {
    if (value || defaultNone) {
      return;
    }

    (async () => {
      const selectedList = getSelectedCellLineListName();
      const selectedContextHash = getSelectedContextHash();

      if (selectedList && selectedList !== "None") {
        const [hash, context] = await persistLegacyListAsContext(
          deprecatedApi,
          selectedList
        );
        setSelectedCellLineListName("None");
        handleChange(context, hash);
      }

      if (selectedContextHash) {
        const hashWithoutPrefix = selectedContextHash.replace("not_", "");
        try {
          const context = await fetchContext(hashWithoutPrefix);

          if (isV2Context(context)) {
            throw new Error("V2 contexts not supported!");
          }

          handleChange(
            selectedContextHash.startsWith("not_")
              ? negateContext(context)
              : context,
            hashWithoutPrefix
          );
        } catch (e) {
          window.console.error(e);
        }
      }

      setIsLoading(false);
    })();
  }, [deprecatedApi, value, defaultNone, handleChange]);

  const handleClickCreateContext = () => {
    DepMap.saveNewContext({ context_type: "depmap_model" }, null, handleChange);
  };

  const handleClickSaveAsContext = () => {
    DepMap.saveNewContext(value, null, setValue);
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
    <ContextSelector
      show
      enable
      value={value}
      context_type="depmap_model"
      onChange={handleChange}
      onClickCreateContext={handleClickCreateContext}
      onClickSaveAsContext={handleClickSaveAsContext}
    />
  );
};

function CellLineListsDropdown({
  defaultNone = false,
  onListSelect,
}: LegacyCellLineListsDropdownProps) {
  return (
    <ContextEnabledDropdown
      defaultNone={defaultNone}
      onListSelect={onListSelect}
    />
  );
}

export default CellLineListsDropdown;
