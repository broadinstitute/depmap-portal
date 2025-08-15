import React, { useEffect, useMemo, useState } from "react";
// import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { cached, legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import styles from "../styles/GeneTea.scss";
import GeneTeaTable from "./GeneTeaTable";
import PlotSelections from "./PlotSelections";
import PlotSection from "./PlotSection";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
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

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);

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
          if (fetchedData.allEnrichedTerms) {
            setSelectedTableRows(new Set(fetchedData.allEnrichedTerms.term));
          }
        } catch (e) {
          setData(null);
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
        Header: "Matching Query",
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

  const heatmapData = useMemo(() => {
    if (data && data.termToEntity) {
      const x = data.termToEntity.gene;
      const y = data.termToEntity.term;
      const zVals = data.termToEntity.fraction;
      return {
        x,
        y,
        z: zVals,
      };
    } else {
      return {
        x: [],
        y: [],
        z: [],
      };
    }
  }, [data]);

  const barChartData = useMemo(
    () =>
      data && data.enrichedTerms
        ? { x: data.enrichedTerms.negLogFDR, y: data.enrichedTerms.termGroup }
        : { x: [], y: [] },
    [data]
  );

  const heatmapXAxisLabel = useMemo(() => {
    if (data && data.termToEntity) {
      // Get a
      return `Matching Genes in List n=(${
        new Set(data.termToEntity.gene).size
      })`;
    }

    return "";
  }, [data]);

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
                selectedIds={new Set(searchTerms)}
                selectedLabels={new Set(searchTerms)}
                onClickSaveSelectionAsContext={() => {}}
                onClickClearSelection={() => {}}
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
        {data && data.allEnrichedTerms && (
          <GeneTeaTable
            error={error}
            isLoading={isLoading}
            tableData={data.allEnrichedTerms.term.map((term, index) => {
              return {
                term: term,
                termGroup: data.allEnrichedTerms!.termGroup[index],
                synonyms: data.allEnrichedTerms!.synonyms[index],
                matchingGenesInList: data.allEnrichedTerms!.matchingGenesInList[
                  index
                ],
                nMatchingGenesOverall: data.allEnrichedTerms!
                  .nMatchingGenesOverall[index],
                nMatchingGenesInList: data.allEnrichedTerms!
                  .nMatchingGenesInList[index],
                fdr: data.allEnrichedTerms!.fdr[index].toFixed(3),
                effectSize: data.allEnrichedTerms!.effectSize[index].toFixed(3),
              };
            })}
            tableColumns={tableColumns}
            columnOrdering={columnOrdering}
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
