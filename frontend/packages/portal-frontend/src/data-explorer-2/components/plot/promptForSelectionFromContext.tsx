import React, { useState } from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import {
  ContextSelector,
  fetchContextLabels,
  getDimensionTypeLabel,
  pluralize,
} from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContext, DataExplorerPlotResponse } from "@depmap/types";

export default async function promptForSelectionFromContext(
  context_type: string,
  datasetLabels: string[],
  filter?: DataExplorerPlotResponse["filters"]["visible"]
) {
  const context = await promptForValue({
    title: "Set selection from context",
    defaultValue: null,
    PromptComponent: ({
      value,
      onChange,
      updateAcceptText,
    }: PromptComponentProps) => {
      const [stats, setStats] = useState<{
        total: number;
        notFound: number;
        hiddenByFilters: number;
      } | null>(null);

      const numberedEntities = (n: number) => {
        const entity = getDimensionTypeLabel(context_type);
        const entities = pluralize(entity);

        return [n.toLocaleString(), n === 1 ? entity : entities].join(" ");
      };

      const handleChange = async (nextContext: DataExplorerContext | null) => {
        onChange(nextContext);

        if (!nextContext) {
          setStats(null);
          updateAcceptText("OK");
          return;
        }

        const result = await fetchContextLabels(nextContext);
        const contextLabels = new Set(result.labels);

        const found = datasetLabels.filter((label) => {
          return contextLabels.has(label);
        }).length;

        const notFound = contextLabels.size - found;

        const hiddenByFilters = datasetLabels
          .map((label, i) => {
            return [label, filter ? filter.values[i] : true];
          })
          .filter(([label]) => contextLabels.has(label as string))
          .filter(([, visible]) => !visible).length;

        setStats({
          total: contextLabels.size,
          notFound,
          hiddenByFilters,
        });

        const selectionLength = contextLabels.size - notFound - hiddenByFilters;

        if (selectionLength === 0) {
          updateAcceptText("OK");
        } else {
          updateAcceptText(`Select ${numberedEntities(selectionLength)}`);
        }
      };

      return (
        <div>
          <ContextSelector
            show
            enable
            value={value}
            onChange={handleChange}
            onClickCreateContext={() => {
              DepMap.saveNewContext({ context_type }, null, handleChange);
            }}
            label="Choose a context"
            context_type={context_type}
            onClickSaveAsContext={() => {}}
            includeAllInOptions={false}
          />
          {stats && (
            <div style={{ marginTop: 15 }}>
              <div>
                This context contains a total of {numberedEntities(stats.total)}
                .
              </div>
              <br />
              {Boolean(stats.notFound) && (
                <div>
                  {numberedEntities(stats.notFound)}{" "}
                  {stats.notFound === 1 ? "is" : "are"} not found in the
                  selected dataset(s).
                </div>
              )}
              {filter && Boolean(stats.hiddenByFilters) && (
                <div>
                  {numberedEntities(stats.hiddenByFilters)}{" "}
                  {stats.hiddenByFilters === 1 ? "is" : "are"} hidden by the “
                  {filter.name}” filter.
                </div>
              )}
            </div>
          )}
        </div>
      );
    },
  });

  if (!context) {
    return null;
  }

  const result = await fetchContextLabels(context);
  const contextLabels = new Set(result.labels);
  const matchingLabels = datasetLabels.filter((label, i) => {
    return contextLabels.has(label) && (!filter || filter.values[i]);
  });

  return matchingLabels.length ? new Set(matchingLabels) : null;
}
