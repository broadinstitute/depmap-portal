import React, { useState } from "react";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { deprecatedDataExplorerAPI } from "../../../../services/deprecatedDataExplorerAPI";
import ContextSelector from "../../../ContextSelector";
import { getDimensionTypeLabel, pluralize } from "../../../../utils/misc";
import { DepMap } from "@depmap/globals";
import { DataExplorerContext, DataExplorerPlotResponse } from "@depmap/types";

export default async function promptForSelectionFromContext(
  data: DataExplorerPlotResponse
) {
  const filter = data!.filters?.visible;

  const datasetLabels = new Set(
    data.index_labels.filter((_, i) => {
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
    }: PromptComponentProps<DataExplorerContext | null>) => {
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

        const found = [...datasetLabels].filter((label) => {
          return contextLabels.has(label);
        }).length;

        const notFound = contextLabels.size - found;

        const hiddenByFilters = data.index_labels
          .map((label, i) => {
            return [
              label,
              datasetLabels.has(label) && filter ? filter.values[i] : true,
            ];
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
              DepMap.saveNewContext(
                { context_type: data.index_type },
                null,
                handleChange
              );
            }}
            label="Choose a context"
            context_type={data.index_type}
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

  const labels = await deprecatedDataExplorerAPI.evaluateLegacyContext(context);
  const contextLabels = new Set(labels);
  const matchingLabels = data.index_labels.filter((label, i) => {
    return (
      datasetLabels.has(label) &&
      contextLabels.has(label) &&
      (filter ? filter.values[i] : true)
    );
  });

  return matchingLabels.length ? new Set(matchingLabels) : null;
}
