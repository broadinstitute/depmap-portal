import React, { useEffect, useState } from "react";
// import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { cached, legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import styles from "../styles/GeneTea.scss";
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
}

type GeneTeaEnrichedTerms = LegacyPortalApiResponse["fetchGeneTeaEnrichmentExperimental"];

function GeneTeaMainContent({
  searchTerms,
  doGroupTerms,
  doClusterGenes,
  doClusterTerms,
}: GeneTeaMainContentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);
  const [error, setError] = useState(false);
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
          ).fetchGeneTeaEnrichmentExperimental([...searchTerms], null);
          setData(fetchedData);
        } catch (e) {
          setError(true);
          window.console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [searchTerms]);
  console.log("search terms", searchTerms);
  console.log("data", data);

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
        {/* <GeneTeaTable
          error={error}
          isLoading={isLoading}
          tableData={tableFormattedData ?? []}
          tableColumns={tableColumns}
          columnOrdering={columnOrdering}
          defaultCols={defaultCols}
          selectedTableRows={selectedTableRows}
          handleChangeSelection={handleChangeTableSelection}
        /> */}
      </div>
    </div>
  );
}

export default GeneTeaMainContent;
