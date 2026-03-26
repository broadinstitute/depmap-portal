import React, { useState, useEffect } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import {
  ContextSelectorV2,
  getDimensionTypeLabel,
  pluralize,
} from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import { useGeneTeaFiltersContext } from "../context/GeneTeaFiltersContext";

const LoadFromGeneContextSection: React.FC = () => {
  const {
    handleSetGeneSymbolSelections,
    handleSetValidGeneSymbols,
    handleSetInValidGeneSymbols,
    allAvailableGenes,
    geneSymbolSelections,
  } = useGeneTeaFiltersContext();

  const indexType = "gene";

  const [value, setValue] = useState<DataExplorerContextV2 | null>(null);

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

  const handleChange = async (nextContext: DataExplorerContextV2 | null) => {
    // If the context is changing, the gene list sent to GeneTEA is changing. Clear out the Valid
    // and Invalid gene sets in preparation to receive a new valid/invalid list from the GeneTEA api.
    handleSetValidGeneSymbols(new Set([]));
    handleSetInValidGeneSymbols(new Set([]));
    setValue(nextContext);

    if (!nextContext) {
      setStats(null);
      handleSetGeneSymbolSelections([]);

      return;
    }

    const { labels } = await cached(breadboxAPI).evaluateContext(nextContext);
    const contextLabels = new Set(labels);

    handleSetGeneSymbolSelections(contextLabels);

    const found = [...allAvailableGenes].filter((label) => {
      return contextLabels.has(label);
    }).length;

    const notFound = contextLabels.size - found;

    setStats({
      total: contextLabels.size,
      notFound,
      hiddenByFilters: 0,
    });
  };

  useEffect(() => {
    if (geneSymbolSelections.size === 0 && value !== null) {
      setValue(null);
      setStats(null);
    }
  }, [geneSymbolSelections, value]);

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
        dimension_type={indexType}
        onClickSaveAsContext={() => {}}
        includeAllInOptions={false}
      />
      {stats && (
        <div style={{ marginTop: 15 }}>
          <div>
            This context contains a total of {numberedEntities(stats.total)}.
          </div>
          <br />
          {Boolean(stats.notFound) && (
            <div>
              {numberedEntities(stats.notFound)}{" "}
              {stats.notFound === 1 ? "is" : "are"} not found in the selected
              dataset(s).
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadFromGeneContextSection;
