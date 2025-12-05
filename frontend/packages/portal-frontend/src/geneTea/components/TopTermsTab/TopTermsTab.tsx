import React, { useMemo, useState } from "react";
import styles from "../../styles/GeneTea.scss";
import GeneTeaTable from "../GeneTeaTable";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { useGeneTeaFiltersContext } from "../../context/GeneTeaFiltersContext";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";

import { useTopTermsContext } from "src/geneTea/context/TopTermsContext";
import PlotSection from "./PlotSection";
import PlotSelections from "./PlotSelections";
import PurpleHelpIcon from "../PurpleHelpIcon";

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
          Term: term,
          "Term Group": rawData.allEnrichedTerms!.termGroup[index],
          Synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          "Matching Query": rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          "n Matching Overall": rawData.allEnrichedTerms!.nMatchingGenesOverall[
            index
          ],
          "n Matching Query": rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          FDR: rawData.allEnrichedTerms!.fdr[index].toExponential(5),
          "Effect Size": rawData.allEnrichedTerms!.effectSize[index].toFixed(4),
        });
        unroundedData.push({
          Term: term,
          "Term Group": rawData.allEnrichedTerms!.termGroup[index],
          Synonyms: rawData.allEnrichedTerms!.synonyms[index].join(";"),
          "Matching Query": rawData.allEnrichedTerms!.matchingGenesInList[
            index
          ],
          "n Matching Overall": rawData.allEnrichedTerms!.nMatchingGenesOverall[
            index
          ],
          "n Matching Query": rawData.allEnrichedTerms!.nMatchingGenesInList[
            index
          ],
          FDR: rawData.allEnrichedTerms!.fdr[index].toExponential(),
          "Effect Size": rawData.allEnrichedTerms!.effectSize[index],
        });
      });
    }
    return { roundedData, unroundedData };
  }, [rawData]);

  const termToMatchingGenesMap = useMemo(() => {
    const lookup = new Map<string, string[]>();
    if (rawData?.allEnrichedTerms) {
      for (let i = 0; i < rawData?.allEnrichedTerms?.term.length; ++i) {
        lookup.set(
          rawData?.allEnrichedTerms?.term[i],
          rawData?.allEnrichedTerms?.matchingGenesInList[i].split(" ")
        );
      }
    }

    return lookup;
  }, [rawData?.allEnrichedTerms]);

  // Default: Top Tea Terms main content
  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3 className={styles.mainContentHeaderTitle}>
          Top {maxTopTerms} Tea {doGroupTerms ? "Term Groups" : "Terms"}
        </h3>
        <div className={styles.mainContentSubtitle}>
          The plot below shows the top enriched terms identified by GeneTEA. The
          heatmap indicates which terms appear in a given query gene’s
          description, while the barplot shows the FDR-corrected significance
          values.{" "}
          <PurpleHelpIcon
            tooltipText="Interaction with the heatmap will offer more information about
          selected genes, while interaction with the table offers the
          opportunity to refer to the relevant text excerpts for a given term.
          To see the enrichment results across all terms matching the query,
          navigate to the ‘All Matching Terms’ tab above."
            popoverId="top-terms-subtitle-help"
          />
        </div>
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
          tableData={roundedAndUnroundedTableData.roundedData}
          prefferedTableDataForDownload={
            roundedAndUnroundedTableData.unroundedData
          }
          selectedTableRows={
            selectedTableRows.size > 0
              ? selectedTableRows
              : new Set(rawData.enrichedTerms?.term)
          }
          termToMatchingGenesMap={termToMatchingGenesMap}
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
