import React, { useCallback, useEffect, useState } from "react";
import styles from "../styles/GeneTea.scss";
import GeneTeaTable from "./GeneTeaTable";
import PlotSelections from "./PlotSelections";
import PlotSection from "./PlotSection";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { tableColumns } from "../utils";
import useData from "../hooks/useData";
import { defaultContextName } from "@depmap/data-explorer-2/src/components/DataExplorerPage/utils";
import { DataExplorerContext } from "@depmap/types";
import { saveNewContext } from "src";

interface GeneTeaMainContentProps {
  searchTerms: Set<string>;
  validGenes: Set<string>;
  invalidGenes: Set<string>;
  doGroupTerms: boolean;
  doClusterGenes: boolean;
  doClusterTerms: boolean;
  handleSetGeneSymbolSelections: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  handleSetInvalidGenes: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  handleSetValidGenes: (selections: React.SetStateAction<Set<string>>) => void;
}

function GeneTeaMainContent({
  searchTerms,
  validGenes,
  invalidGenes,
  doGroupTerms,
  doClusterGenes,
  doClusterTerms,
  handleSetGeneSymbolSelections,
  handleSetInvalidGenes,
  handleSetValidGenes,
}: GeneTeaMainContentProps) {
  const {
    isLoading,
    error,
    rawData,
    heatmapData,
    barChartData,
    heatmapXAxisLabel,
  } = useData(
    searchTerms,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    handleSetInvalidGenes,
    handleSetValidGenes
  );

  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (rawData && rawData.allEnrichedTerms) {
      setSelectedTableRows(new Set(rawData.allEnrichedTerms.term));
    }
  }, [rawData]);

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  const handleClickSaveSelectionAsContext = useCallback(() => {
    const labels = [...validGenes];
    const context = {
      name: defaultContextName(validGenes.size),
      context_type: "gene",
      expr: { in: [{ var: "entity_label" }, labels] },
    };
    saveNewContext(context as DataExplorerContext);
  }, [validGenes]);

  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3>Top Tea Terms</h3>
      </div>
      {!isLoading && error ? (
        <div className={styles.errorMessage}>Error loading plot data.</div>
      ) : (
        <>
          <div className={styles.mainContentGrid}>
            <div className={styles.plotArea}>
              <PlotSection
                isLoading={isLoading}
                plotElement={plotElement}
                heatmapFormattedData={heatmapData}
                barChartData={barChartData}
                // selectedGeneSymbols={searchTerms}
                // handleSetSelectedPlotModels={() => {}}
                handleClearSelection={() => {}}
                handleSetPlotElement={setPlotElement}
                heatmapXAxisLabel={heatmapXAxisLabel}
              />
            </div>
            <div className={styles.selectionsArea}>
              <PlotSelections
                selectedIds={new Set(validGenes)}
                selectedLabels={new Set(validGenes)}
                onClickSaveSelectionAsContext={
                  handleClickSaveSelectionAsContext
                }
                onClickClearSelection={() => {
                  handleSetInvalidGenes(new Set([]));
                  handleSetValidGenes(new Set([]));
                  handleSetGeneSymbolSelections(new Set([]));
                }}
                onClickSetSelectionFromContext={undefined}
              />
            </div>
          </div>{" "}
        </>
      )}
      <hr className={styles.mainContentHr} />
      <div className={styles.mainContentTableHeader}>
        <h3>Enrichment Term Table</h3>
        <p>Terms selected in the plot will appear checked in this table. </p>
      </div>
      <div>
        {rawData && rawData.allEnrichedTerms && (
          <GeneTeaTable
            error={error}
            isLoading={isLoading}
            tableData={rawData.allEnrichedTerms.term.map((term, index) => {
              return {
                term: term,
                termGroup: rawData.allEnrichedTerms!.termGroup[index],
                synonyms: rawData.allEnrichedTerms!.synonyms[index],
                matchingGenesInList: rawData.allEnrichedTerms!
                  .matchingGenesInList[index],
                nMatchingGenesOverall: rawData.allEnrichedTerms!
                  .nMatchingGenesOverall[index],
                nMatchingGenesInList: rawData.allEnrichedTerms!
                  .nMatchingGenesInList[index],
                fdr: rawData.allEnrichedTerms!.fdr[index].toFixed(3),
                effectSize: rawData.allEnrichedTerms!.effectSize[index].toFixed(
                  3
                ),
              };
            })}
            tableColumns={tableColumns}
            columnOrdering={tableColumns.map((col) => col.accessor)}
            defaultCols={tableColumns.map((col) => col.accessor)}
            selectedTableRows={selectedTableRows}
            handleChangeSelection={(selections: string[]) =>
              setSelectedTableRows(new Set(selections))
            }
          />
        )}
      </div>
    </div>
  );
}

export default GeneTeaMainContent;
