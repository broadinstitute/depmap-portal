import React, { useMemo, useState } from "react";
import styles from "../../styles/GeneTea.scss";
import GeneTeaTable from "../GeneTeaTable";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { tableColumns } from "../../utils";
import { useGeneTeaFiltersContext } from "../../context/GeneTeaFiltersContext";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";

import { useTopTermsContext } from "src/geneTea/context/TopTermsContext";
import PlotSection from "./PlotSection";
import PlotSelections from "./PlotSelections";

interface TopTermsTabProps {
  rawData: GeneTeaEnrichedTerms | null;
  heatmapData: {
    x: string[];
    y: string[];
    z: number[];
    customdata: string[];
  };
  barChartData: {
    x: number[];
    y: string[];
    customdata: string[];
  };
  heatmapXAxisLabel: string;
}

function TopTermsTab({
  rawData,
  heatmapData,
  barChartData,
  heatmapXAxisLabel,
}: TopTermsTabProps) {
  const {
    selectedTopTermsTableRows: selectedTableRows,
    handleSetSelectedTopTermsTableRows: handleSetSelectedTableRows,
    selectedPlotGenes,
    doGroupTerms,
    maxTopTerms,
    isLoading,
    error,
  } = useGeneTeaFiltersContext();

  const {
    handleClickSavePlotSelectionAsContext,
    handleClearPlotSelection,
  } = useTopTermsContext();

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  // Get the table data and prefferedTableDataForDownload. Combined in this useMemo so we don't
  // have to iterate through allEnrichedTerms twice. The only difference is that the tableData is
  // rounded, while the prefferedTableDataForDownload is NOT rounded.
  const roundedAndUnroundedTableData = useMemo(() => {
    // TODO give these a real type
    const roundedData: any = [];
    const unroundedData: any = [];
    if (rawData?.allEnrichedTerms) {
      rawData.allEnrichedTerms.term.forEach((term, index) => {
        roundedData.push({
          term,
          synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.allEnrichedTerms!
            .nMatchingGenesOverall[index],
          nMatchingGenesInList: rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.allEnrichedTerms!.fdr[index].toExponential(5),
          effectSize: rawData.allEnrichedTerms!.effectSize[index].toFixed(4),
        });
        unroundedData.push({
          term,
          synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.allEnrichedTerms!
            .nMatchingGenesOverall[index],
          nMatchingGenesInList: rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.allEnrichedTerms!.fdr[index].toExponential(),
          effectSize: rawData.allEnrichedTerms!.effectSize[index],
        });
      });
    }
    return { roundedData, unroundedData };
  }, [rawData]);

  // Default: Top Tea Terms main content
  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3 className={styles.mainContentHeaderTitle}>
          Top {maxTopTerms} Tea {doGroupTerms ? "Term Groups" : "Terms"}
        </h3>
      </div>
      {!isLoading && error ? (
        <div className={styles.errorMessage}>Error loading plot data.</div>
      ) : (
        <div>
          <div className={styles.mainContentGrid}>
            <div className={styles.plotArea}>
              <PlotSection
                isLoading={isLoading}
                plotElement={plotElement}
                heatmapFormattedData={heatmapData}
                barChartData={barChartData}
                handleSetPlotElement={setPlotElement}
                heatmapXAxisLabel={heatmapXAxisLabel}
              />
            </div>
            <div className={styles.selectionsArea}>
              <PlotSelections
                isPlotDataVisible={!isLoading && heatmapData.z.length > 0}
                selectedIds={new Set(selectedPlotGenes)}
                selectedLabels={new Set(selectedPlotGenes)}
                onClickSaveSelectionAsContext={
                  handleClickSavePlotSelectionAsContext
                }
                onClickClearSelection={handleClearPlotSelection}
              />
            </div>
          </div>
        </div>
      )}
      <hr className={styles.mainContentHr} />
      <div className={styles.mainContentTableHeader}>
        <h3 className={styles.mainContentTableHeaderTitle}>
          Enrichment Term Table
        </h3>
        <p>Terms selected in the plot will appear checked in this table.</p>
      </div>

      {rawData && rawData.allEnrichedTerms && rawData.enrichedTerms && (
        <GeneTeaTable
          error={error}
          isLoading={isLoading}
          height={800}
          tableData={roundedAndUnroundedTableData.roundedData}
          prefferedTableDataForDownload={
            roundedAndUnroundedTableData.unroundedData
          }
          tableColumns={tableColumns}
          columnOrdering={tableColumns.map((col) => col.accessor)}
          defaultCols={tableColumns.map((col) => col.accessor)}
          selectedTableRows={
            selectedTableRows.size > 0
              ? selectedTableRows
              : new Set(rawData.enrichedTerms?.term)
          }
          handleChangeSelection={(selections: string[]) => {
            if (selections.length === 0) return;
            handleSetSelectedTableRows(new Set(selections));
          }}
        />
      )}
    </div>
  );
}

export default TopTermsTab;
