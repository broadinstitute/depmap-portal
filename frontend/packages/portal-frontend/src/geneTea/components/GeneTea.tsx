import React, { useCallback, useState } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import { TabsWithHistory } from "src/common/components/tabs/TabsWithHistory";
import { Tab, TabList, TabPanel, TabPanels } from "src/common/components/tabs";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptionsContainer from "./SearchOptionsContainer";
import { GeneTeaContext } from "../context/GeneTeaContext";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import { useEffect } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { SortOption } from "../types";

async function fetchMetadata<T>(
  typeName: string,
  indices: string[] | null,
  columns: string[] | null,
  bbapi: typeof breadboxAPI,
  identifier: "label" | "id" = "id"
) {
  const dimType = await cached(bbapi).getDimensionType(typeName);
  if (!dimType?.metadata_dataset_id) {
    throw new Error(`No metadata for ${typeName}`);
  }

  let args;
  if (indices && indices.length > 0) {
    args = { indices, identifier, columns };
  } else {
    args = { indices: null, identifier: null, columns };
  }
  return cached(bbapi).getTabularDatasetData(
    dimType.metadata_dataset_id,
    args
  ) as Promise<T>;
}

function GeneTea() {
  const [doGroupTerms, setDoGroupTerms] = useState<boolean>(true);
  const [doClusterGenes, setDoClusterGenes] = useState<boolean>(true);
  const [doClusterTerms, setDoClusterTerms] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<SortOption>("Significance");

  const [geneSymbolSelections, setGeneSymbolSelections] = useState<Set<string>>(
    new Set([])
  );

  const [validGeneSymbols, setValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );
  const [inValidGeneSymbols, setInValidGeneSymbols] = useState<Set<string>>(
    new Set([])
  );
  const [allAvailableGenes, setAllAvailableGenes] = useState<Set<string>>(
    new Set([])
  );
  const [effectSizeThreshold, setEffectSizeThreshold] = useState<number>(0.1);
  const [minMatchingQuery, setMinMatchingQuery] = useState<number>(2);
  const [maxMatchingOverall, setMaxMatchingOverall] = useState<number | null>(
    5357
  );
  const [maxTopTerms, setMaxTopTerms] = useState<number | null>(10);
  const [maxFDR, setMaxFDR] = useState<number>(0.05);

  useEffect(() => {
    (async () => {
      const geneMetadata = await fetchMetadata<any>(
        "gene",
        null,
        ["label"],
        breadboxAPI,
        "id"
      );

      setAllAvailableGenes(new Set(Object.values(geneMetadata.label)));
    })();
  }, []);

  const handleSetSelectionFromContext = useCallback(async () => {
    const labels = await promptForSelectionFromContext(
      allAvailableGenes,
      "gene"
    );
    if (labels === null) {
      return;
    }

    setGeneSymbolSelections(labels);
  }, [allAvailableGenes]);

  return (
    <GeneTeaContext.Provider
      value={{
        effectSizeThreshold,
        setEffectSizeThreshold,
        minMatchingQuery,
        setMinMatchingQuery,
        maxMatchingOverall,
        setMaxMatchingOverall,
        maxTopTerms,
        setMaxTopTerms,
        maxFDR,
        setMaxFDR,
        doGroupTerms,
        setDoGroupTerms,
        doClusterGenes,
        setDoClusterGenes,
        doClusterTerms,
        setDoClusterTerms,
        sortBy,
        setSortBy,
        geneSymbolSelections,
        setGeneSymbolSelections,
        validGeneSymbols,
        setValidGeneSymbols,
        inValidGeneSymbols,
        setInValidGeneSymbols,
        allAvailableGenes,
        setAllAvailableGenes,
        handleSetSelectionFromContext,
      }}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>
            <span>Tea Party</span>
          </h1>
          <p>
            GeneTEA (Gene-Term Enrichment Analysis) is a model that takes in
            free-text gene descriptions and incorporates several natural
            language processing methods to learn a sparse gene-by-term
            embedding, which can be treated as a de novo gene set database.
          </p>
        </header>
        <main className={styles.main}>
          <div className={styles.geneTeaTabLayout}>
            <div className={styles.geneTeaFilters}>
              <SearchOptionsContainer />
            </div>
            <div className={styles.geneTeaTabsWrapper}>
              <TabsWithHistory
                className={styles.Tabs}
                onChange={() => {
                  /* add something later */
                }}
                onSetInitialIndex={() => {
                  /* add something later */
                }}
                isManual
                isLazy
              >
                <TabList className={styles.TabList}>
                  <Tab id="top-tea-terms" className={styles.Tab}>
                    Top Tea Terms
                  </Tab>
                  <Tab id="all-matching-terms" className={styles.Tab}>
                    All Matching Terms
                  </Tab>
                </TabList>
                <TabPanels className={styles.TabPanels}>
                  <TabPanel className={styles.TabPanel}>
                    <GeneTeaMainContent tab="top-tea-terms" />
                  </TabPanel>
                  <TabPanel className={styles.TabPanel}>
                    <GeneTeaMainContent tab="all-matching-terms" />
                  </TabPanel>
                </TabPanels>
              </TabsWithHistory>
            </div>
          </div>
        </main>
      </div>
    </GeneTeaContext.Provider>
  );
}

export default GeneTea;
