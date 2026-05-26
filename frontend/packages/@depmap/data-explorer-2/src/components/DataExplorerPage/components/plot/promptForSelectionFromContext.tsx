import React, { useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";
import ContextSelectorV2 from "../../../ContextSelectorV2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2, DataExplorerPlotResponse } from "@depmap/types";

const resolveToIds = async (context: DataExplorerContextV2) => {
  const result = await cached(breadboxAPI).evaluateContext(context);
  return result.ids;
};

export default async function promptForSelectionFromContext(
  data: DataExplorerPlotResponse
) {
  const filter = data!.filters?.visible;

  // Identity comparisons in this function use Breadbox IDs throughout —
  // resolved from contexts via `resolveToIds`, sourced from plot responses
  // via `data.index_ids`. The returned `Set<string>` is consumed by plot
  // components as `selectedIds` state.
  const datasetIds = new Set(
    data.index_ids.filter((_, i) => {
      return (
        data!.dimensions.x.values[i] !== null &&
        data!.dimensions.y?.values[i] !== null
      );
    })
  );

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
        const entity = getDimensionTypeLabel(data.index_type);
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

        const ids = await resolveToIds(nextContext);
        const contextIds = new Set(ids);

        const found = [...datasetIds].filter((id) => {
          return contextIds.has(id);
        }).length;

        const notFound = contextIds.size - found;

        const hiddenByFilters = data.index_ids
          .map((id, i) => {
            return [
              id,
              datasetIds.has(id) && filter ? filter.values[i] : true,
            ];
          })
          .filter(([id]) => contextIds.has(id as string))
          .filter(([, visible]) => !visible).length;

        setStats({
          total: contextIds.size,
          notFound,
          hiddenByFilters,
        });

        const selectionLength = contextIds.size - notFound - hiddenByFilters;

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
                { dimension_type: data.index_type },
                null,
                handleChange
              );
            }}
            label="Choose a context"
            dimension_type={data.index_type}
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

  const ids = await resolveToIds(context);
  const contextIds = new Set(ids);
  const matchingIds = data.index_ids.filter((id, i) => {
    return (
      datasetIds.has(id) &&
      contextIds.has(id) &&
      (filter ? filter.values[i] : true)
    );
  });

  return matchingIds.length ? new Set(matchingIds) : null;
}
