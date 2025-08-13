import React, { useEffect, useMemo, useState } from "react";
// import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { cached, legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import styles from "../styles/GeneTea.scss";
import GeneTeaTable from "./GeneTeaTable";
// import PlotSelections from "./PlotSelections";
// import PlotSection from "./PlotSection";

// TODO: picked these numbers at random. Figure out what they should actually be.
const MIN_SELECTION = 3;
const MAX_SELECTION = 300; // TODO: The API will error at a certain number. Make sure this doesn't exceed that number.
interface GeneTeaMainContentProps {
  searchTerms: Set<string>;
  doGroupTerms: boolean;
  doClusterGenes: boolean;
  doClusterTerms: boolean;
  handleSetInvalidGenes: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
}

type GeneTeaEnrichedTerms = LegacyPortalApiResponse["fetchGeneTeaEnrichmentExperimental"];

function GeneTeaMainContent({
  searchTerms,
  doGroupTerms,
  doClusterGenes,
  doClusterTerms,
  handleSetInvalidGenes,
}: GeneTeaMainContentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);
  const [error, setError] = useState(false);

  const [selectedTableRows, setSelectedTableRows] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (
      searchTerms &&
      searchTerms.size >= MIN_SELECTION &&
      searchTerms.size <= MAX_SELECTION
    ) {
      setIsLoading(true);
      setError(false);

      (async () => {
        try {
          const fetchedData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaEnrichmentExperimental(
            [...searchTerms],
            null,
            doGroupTerms,
            doClusterGenes,
            doClusterTerms
          );
          setData(fetchedData);
        } catch (e) {
          setData(null);
          console.log("error");
          setError(true);
          window.console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      setData(null);
      setIsLoading(false);
    }
  }, [searchTerms]);
  console.log("search terms", searchTerms);
  console.log("data", data);

  const tableColumns = useMemo(
    () => [
      { accessor: "term", Header: "Term", maxWidth: 120, minWidth: 80 },
      {
        accessor: "termGroup",
        Header: "Term Group",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "fdr",
        Header: "FDR",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "effectSize",
        Header: "Effect Size",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "matchingGenesInList",
        Header: "Matching Genes in List",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "nMatchingGenesInList",
        Header: "n Matching Query",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "nMatchingGenesOverall",
        Header: "n Matching Overall",
        maxWidth: 120,
        minWidth: 80,
      },
      {
        accessor: "synonyms",
        Header: "Synonyms",
        maxWidth: 120,
        minWidth: 80,
      },
    ],
    []
  );

  const columnOrdering = useMemo(
    () => tableColumns.map((col) => col.accessor),
    [tableColumns]
  );

  return (
    <div className={styles.mainContentContainer}>
      <div className={styles.mainContentHeader}>
        <h3>Top Tea Terms</h3>
      </div>
      {false ? (
        <div className={styles.errorMessage}>Error loading plot data.</div>
      ) : (
        <>
          <div className={styles.mainContentGrid}>
            <div className={styles.plotArea}>
              {/* <PlotSection
                isLoading={isLoading}
                compoundName={compoundName}
                plotElement={plotElement}
                heatmapFormattedData={heatmapFormattedData}
                doseMin={doseMin}
                doseMax={doseMax}
                doseUnits={doseUnits}
                selectedModelIds={selectedModelIds}
                handleSetSelectedPlotModels={handleSetSelectedPlotModels}
                handleClearSelection={handleClearSelection}
                handleSetPlotElement={setPlotElement}
                displayNameModelIdMap={displayNameModelIdMap}
                visibleZIndexes={visibleZIndexes}
                showUnselectedLines={showUnselectedLines}
              /> */}
            </div>
            <div className={styles.selectionsArea}>
              {/* <PlotSelections
                selectedIds={selectedModelIds}
                selectedLabels={new Set(selectedLabels)}
                onClickSaveSelectionAsContext={
                  handleClickSaveSelectionAsContext
                }
                onClickClearSelection={handleClearSelection}
                onClickSetSelectionFromContext={
                  heatmapFormattedData
                    ? handleSetSelectionFromContext
                    : undefined
                }
              /> */}
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
        <GeneTeaTable
          error={error}
          isLoading={isLoading}
          tableData={data?.term.map((term, index) => {
            return {
              term: term,
              termGroup: data.termGroup[index],
              synonyms: data.synonyms[index],
              matchingGenesInList: data.matchingGenesInList[index].join(" "),
              nMatchingGenesOverall: data.nMatchingGenesOverall[index],
              nMatchingGenesInList: data.nMatchingGenesInList[index],
              fdr: data.fdr[index].toFixed(3),
              effectSize: data.effectSize[index].toFixed(3),
            };
          })}
          tableColumns={tableColumns}
          columnOrdering={columnOrdering}
          defaultCols={tableColumns.map((col) => col.accessor)}
          selectedTableRows={selectedTableRows}
          handleChangeSelection={() => {}}
        />
      </div>
    </div>
  );
}

export default GeneTeaMainContent;
