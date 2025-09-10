import React, { useMemo, useState } from "react";
import styles from "../styles/GeneTea.scss";
import GeneTeaTable from "./GeneTeaTable";
import PlotSelections from "./PlotSelections";
import PlotSection from "./PlotSection";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { groupStringsByCondition, tableColumns } from "../utils";
import useData from "../hooks/useData";
import { useGeneTeaContext } from "../context/GeneTeaContext";

interface GeneTeaMainContentProps {
  tab: "top-tea-terms" | "all-matching-terms";
}

function GeneTeaMainContent({ tab }: GeneTeaMainContentProps) {
  const {
    geneSymbolSelections,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxTopTerms,
    maxFDR,
    maxMatchingOverall,
    minMatchingQuery,
    effectSizeThreshold,
    selectedTableRows,
    selectedPlotGenes,
    handleSetValidGeneSymbols,
    handleSetInValidGeneSymbols,
    handleSetSelectedTableRows,
    handleClickSavePlotSelectionAsContext,
    handleClearPlotSelection,
    handleSetIsLoading,
    isLoading,
    error,
    handleSetError,
    handleSetErrorMessage,
  } = useGeneTeaContext();

  const plotSelections = useMemo(
    () => (selectedTableRows.size > 0 ? selectedTableRows : new Set([])),
    [selectedTableRows]
  );

  // HACK: GeneTEA returns an error if any searchTerm is less
  // than 2 characters long. Instead of erroring completely,
  // we want to treat these search terms the same as any other invalid
  //  term (i.e. ["SOX10", "KRAS", "NRAS", "NOT_A_GENE"] will still
  // return a response with invalid_genes = ["NOT_A_GENE"], so ["SOX10", "KRAS", "NRAS", "A"]
  // will still return a response with invalid_genes = ["A"]). Separate
  // our definitely invalid less than 2 characters out from the possiblyValidTerms
  // before sending a request to GeneTEA.
  const [specialCaseInvalidGenes, possiblyValidGenes] = useMemo(
    () =>
      groupStringsByCondition(
        Array.from(geneSymbolSelections),
        (term) => term.length < 2
      ),
    [geneSymbolSelections]
  );

  const { rawData, heatmapData, barChartData, heatmapXAxisLabel } = useData(
    plotSelections,
    specialCaseInvalidGenes,
    possiblyValidGenes,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxFDR,
    maxTopTerms,
    maxMatchingOverall,
    minMatchingQuery,
    effectSizeThreshold,
    handleSetInValidGeneSymbols,
    handleSetValidGeneSymbols,
    handleSetIsLoading,
    handleSetError,
    handleSetErrorMessage
  );

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
          termGroup: rawData.allEnrichedTerms!.termGroup[index],
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
          termGroup: rawData.allEnrichedTerms!.termGroup[index],
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

  if (tab === "all-matching-terms") {
    return (
      <div style={{ padding: "25px" }}>
        <h2>Coming soon!</h2>
      </div>
    );
  }
  // Default: Top Tea Terms main content
  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3 className={styles.mainContentHeaderTitle}>
          Top {maxTopTerms} Tea Terms
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
      <div>
        {rawData && rawData.allEnrichedTerms && rawData.enrichedTerms && (
          <GeneTeaTable
            error={error}
            isLoading={isLoading}
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
            handleChangeSelection={(selections: string[]) =>
              handleSetSelectedTableRows(new Set(selections))
            }
          />
        )}
      </div>
    </div>
  );
}

export default GeneTeaMainContent;
