import React, { useMemo, useState } from "react";
import styles from "../../styles/GeneTea.scss";
import GeneTeaTable from "../GeneTeaTable";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { tableColumns } from "../../utils";
import { useGeneTeaFiltersContext } from "../../context/GeneTeaFiltersContext";
import {
  GeneTeaEnrichedTerms,
  GeneTeaScatterPlotData,
} from "@depmap/types/src/experimental_genetea";
import PlotSection from "./PlotSection";
import { useAllTermsContext } from "src/geneTea/context/AllTermsContext";

interface AllMatchingTermsTabProps {
  data: GeneTeaScatterPlotData | null;
  rawData: GeneTeaEnrichedTerms | null;
}

function AllMatchingTermsTab({ data, rawData }: AllMatchingTermsTabProps) {
  const { isLoading, error } = useGeneTeaFiltersContext();
  const {
    selectedPlotOrTableTerms,
    handleSetPlotOrTableSelectedTerms,
  } = useAllTermsContext();

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

  const selectedTableRows = useMemo(() => {
    if (selectedPlotOrTableTerms.size > 0) {
      return selectedPlotOrTableTerms;
    }
    return new Set(rawData?.enrichedTerms?.term);
  }, [selectedPlotOrTableTerms, rawData]);

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
        <h3 className={styles.mainContentHeaderTitle}>All Matching Terms</h3>
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
          selectedTableRows={selectedTableRows}
          handleChangeSelection={(selections: string[]) => {
            if (selections.length === 0) return;
            handleSetPlotOrTableSelectedTerms(new Set(selections), false);
          }}
        />
      )}
    </div>
  );
}

export default AllMatchingTermsTab;
