import React, { useCallback, useState } from "react";
import GeneTeaMainContent from "./GeneTeaMainContent";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "src/common/styles/typeahead_fix.scss";
import styles from "../styles/GeneTea.scss";
import SearchOptionsContainer from "./SearchOptionsContainer";
import promptForSelectionFromContext from "./promptForSelectionFromContext";
import { useEffect } from "react";
import { breadboxAPI, cached } from "@depmap/api";

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
    <div className={styles.geneTeaGrid}>
      <div className={styles.geneTeaFilters}>
        <SearchOptionsContainer
          handleToggleGroupTerms={setDoGroupTerms}
          handleToggleClusterGenes={setDoClusterGenes}
          handleToggleClusterTerms={setDoClusterTerms}
          handleSetGeneSymbolSelections={setGeneSymbolSelections}
          handleSetInvalidGenes={setInValidGeneSymbols}
          handleSetValidGenes={setValidGeneSymbols}
          allSelections={geneSymbolSelections}
          validSelections={validGeneSymbols}
          invalidSelections={inValidGeneSymbols}
        />
      </div>
      <div className={styles.geneTeaMain}>
        <GeneTeaMainContent
          searchTerms={geneSymbolSelections}
          validGenes={validGeneSymbols}
          invalidGenes={inValidGeneSymbols}
          doGroupTerms={doGroupTerms}
          doClusterGenes={doClusterGenes}
          doClusterTerms={doClusterTerms}
          handleSetGeneSymbolSelections={setGeneSymbolSelections}
          handleSetInvalidGenes={setInValidGeneSymbols}
          handleSetValidGenes={setValidGeneSymbols}
          handleSetSelectionFromContext={handleSetSelectionFromContext}
        />
      </div>
    </div>
  );
}

export default GeneTea;
