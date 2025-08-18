import React, { useCallback, useState } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
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
      <div className={styles.geneTeaGrid}>
        <div className={styles.geneTeaFilters}>
          <SearchOptionsContainer />
        </div>
        <div className={styles.geneTeaMain}>
          <GeneTeaMainContent />
        </div>
      </div>
    </GeneTeaContext.Provider>
  );
}

export default GeneTea;
