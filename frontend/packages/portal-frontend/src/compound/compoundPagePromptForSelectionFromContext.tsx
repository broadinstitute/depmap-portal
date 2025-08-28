import React, { useState } from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import {
  ContextSelector,
  deprecatedDataExplorerAPI,
  getDimensionTypeLabel,
  pluralize,
} from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContext } from "@depmap/types";

export default async function compoundPagePromptForSelectionFromContext(
  allPossibleLabels: Set<string>
) {
  const indexType = "depmap_model";
  const context = await promptForValue({
    title: "Set selection from context",
    defaultValue: null,
    PromptComponent: ({
      value,
      onChange,
      updateAcceptText,
    }: PromptComponentProps<DataExplorerContext | null>) => {
      const [stats, setStats] = useState<{
        total: number;
        notFound: number;
        hiddenByFilters: number;
      } | null>(null);

      const numberedEntities = (n: number) => {
        const entity = getDimensionTypeLabel(indexType);
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

        const labels = await deprecatedDataExplorerAPI.evaluateLegacyContext(
          nextContext
        );
        const contextLabels = new Set(labels);

        const found = [...allPossibleLabels].filter((label) => {
          return contextLabels.has(label);
        }).length;

        const notFound = contextLabels.size - found;

        setStats({
          total: contextLabels.size,
          notFound,
          hiddenByFilters: 0,
        });

        const selectionLength = contextLabels.size - notFound;

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
              DepMap.saveNewContext(
                { context_type: indexType },
                null,
                handleChange
              );
            }}
            label="Choose a context"
            context_type={indexType}
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
            </div>
          )}
        </div>
      );
    },
  });

  if (!context) {
    return null;
  }

  const labels = await deprecatedDataExplorerAPI.evaluateLegacyContext(context);
  const contextLabels = new Set(labels);
  const matchingLabels = [...allPossibleLabels].filter((label) => {
    return allPossibleLabels.has(label) && contextLabels.has(label);
  });

  return matchingLabels.length ? new Set(matchingLabels) : null;
}
