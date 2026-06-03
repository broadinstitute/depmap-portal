import React, { useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import {
  ContextSelectorV2,
  getDimensionTypeLabel,
  pluralize,
} from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";

export default async function compoundPagePromptForSelectionFromContext(
  allPossibleIds: Set<string>
) {
  const indexType = "depmap_model";
  const context = await promptForValue({
    title: "Set selection from context",
    defaultValue: null,
    PromptComponent: ({
      value,
      onChange,
      updateAcceptText,
    }: PromptComponentProps<DataExplorerContextV2 | null>) => {
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

      const handleChange = async (
        nextContext: DataExplorerContextV2 | null
      ) => {
        onChange(nextContext);

        if (!nextContext) {
          setStats(null);
          updateAcceptText("OK");
          return;
        }

        const { ids } = await cached(breadboxAPI).evaluateContext(nextContext);
        const contextIds = new Set(ids);

        const found = [...allPossibleIds].filter((label) => {
          return contextIds.has(label);
        }).length;

        const notFound = contextIds.size - found;

        setStats({
          total: contextIds.size,
          notFound,
          hiddenByFilters: 0,
        });

        const selectionLength = contextIds.size - notFound;

        if (selectionLength === 0) {
          updateAcceptText("OK");
        } else {
          updateAcceptText(`Select ${numberedEntities(selectionLength)}`);
        }
      };

      return (
        <div>
          <ContextSelectorV2
            show
            enable
            value={value}
            onChange={handleChange}
            onClickCreateContext={() => {
              DepMap.saveNewContext(
                { dimension_type: indexType },
                undefined,
                handleChange
              );
            }}
            label="Choose a context"
            dimension_type={indexType}
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

  const { ids } = await cached(breadboxAPI).evaluateContext(context);
  const contextIds = new Set(ids);
  const matchingIds = [...allPossibleIds].filter((id) => {
    return contextIds.has(id);
  });

  return matchingIds.length ? new Set(matchingIds) : null;
}
