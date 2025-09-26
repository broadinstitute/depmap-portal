import React, { useMemo, useState } from "react";
import styles from "../../styles/GeneTea.scss";
import GeneTeaTable from "../GeneTeaTable";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { groupStringsByCondition, tableColumns } from "../../utils";
import useData from "../../hooks/useData";
import { useGeneTeaFiltersContext } from "../../context/GeneTeaFiltersContext";
import {
  GeneTeaEnrichedTerms,
  GeneTeaScatterPlotData,
} from "@depmap/types/src/experimental_genetea";
import PlotSection from "./PlotSection";
import { useAllTermsContext } from "src/geneTea/context/AllTermsContext";
import PlotSelections from "./PlotSelections";

interface AllMatchingTermsTabProps {
  data: GeneTeaScatterPlotData | null;
  rawData: GeneTeaEnrichedTerms | null;
}

function AllMatchingTermsTab({ data, rawData }: AllMatchingTermsTabProps) {
  const {
    selectedTopTermsTableRows: selectedTableRows,
    handleSetSelectedTopTermsTableRows: handleSetSelectedTableRows,
    selectedPlotGenes,
    doGroupTerms,
    maxTopTerms,
    isLoading,
    error,
  } = useGeneTeaFiltersContext();

  const {} = useAllTermsContext();

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  // Get the table data and prefferedTableDataForDownload. Combined in this useMemo so we don't
  // have to iterate through allEnrichedTerms twice. The only difference is that the tableData is
  // rounded, while the prefferedTableDataForDownload is NOT rounded.
  const roundedAndUnroundedTableData = useMemo(() => {
    // TODO give these a real type
    const roundedData: any = [];
    const unroundedData: any = [];
    if (rawData?.frequentTerms) {
      rawData.frequentTerms.term.forEach((term, index) => {
        roundedData.push({
          term,
          synonyms: rawData.frequentTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.frequentTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.frequentTerms!.nMatchingGenesOverall[
            index
          ],
          nMatchingGenesInList: rawData.frequentTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.frequentTerms!.fdr[index].toExponential(5),
          effectSize: rawData.frequentTerms!.effectSize[index].toFixed(4),
        });
        unroundedData.push({
          term,
          synonyms: rawData.frequentTerms!.synonyms[index].join(";"),
          matchingGenesInList: rawData.frequentTerms!.matchingGenesInList[
            index
          ],
          nMatchingGenesOverall: rawData.frequentTerms!.nMatchingGenesOverall[
            index
          ],
          nMatchingGenesInList: rawData.frequentTerms!.nMatchingGenesInList[
            index
          ],
          fdr: rawData.frequentTerms!.fdr[index].toExponential(),
          effectSize: rawData.frequentTerms!.effectSize[index],
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
                data={data}
                handleSetPlotElement={setPlotElement}
              />
            </div>
            {/* <div className={styles.selectionsArea}>
              <PlotSelections
                isPlotDataVisible={!isLoading && data !== null}
                selectedIds={new Set([])}
                selectedLabels={new Set([])}
                onClickSaveSelectionAsContext={() => {}}
                onClickClearSelection={() => {}}
              />
            </div> */}
          </div>
        </div>
      )}
      <hr className={styles.mainContentHr} />
      <div className={styles.mainContentTableHeader}>
        <h3 className={styles.mainContentTableHeaderTitle}>All Terms Table</h3>
        {/* <p>Terms selected in the plot will appear checked in this table.</p> */}
      </div>

      {rawData && rawData.frequentTerms && (
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

export default AllMatchingTermsTab;
