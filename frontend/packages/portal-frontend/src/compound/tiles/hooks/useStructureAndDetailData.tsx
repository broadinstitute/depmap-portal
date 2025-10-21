import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { compoundImageBaseURL, pythonQuote } from "src/compound/utils";

interface CompoundDetailsResponseWSymbols {
  GeneSymbolOfTargets: { [compoundId: string]: string[] | null };
  TargetOrMechanism: { [compoundId: string]: string };
  SMILES: { [compoundId: string]: string | null };
  PubChemCID: { [compoundId: string]: string };
  ChEMBLID: { [compoundId: string]: string };
}

interface CompoundDetailsResponse {
  EntrezIDsOfTargets: { [compoundId: string]: string[] | null };
  TargetOrMechanism: { [compoundId: string]: string };
  SMILES: { [compoundId: string]: string | null };
  PubChemCID: { [compoundId: string]: string };
  ChEMBLID: { [compoundId: string]: string };
}

type SymbolTargetMap = { [compoundId: string]: string[] | null };

function mapEntrezIdToSymbols(
  compoundMetadata: CompoundDetailsResponse,
  geneMetadata: { label: { [key: number]: string } }
): CompoundDetailsResponseWSymbols {
  const symbolLookup = geneMetadata.label;
  const geneSymbolOfTargets: SymbolTargetMap = {};

  // 1. Calculate the new 'GeneSymbolOfTargets' map
  for (const compoundId in compoundMetadata.EntrezIDsOfTargets) {
    if (compoundMetadata.EntrezIDsOfTargets.hasOwnProperty(compoundId)) {
      const entrezIds = compoundMetadata.EntrezIDsOfTargets[compoundId];

      const geneSymbols = entrezIds
        ? entrezIds.map((entrezId) => {
            // Look up the symbol, using the Entrez ID as fallback if not found.
            return symbolLookup[Number(entrezId)] || entrezId;
          })
        : null;

      geneSymbolOfTargets[compoundId] = geneSymbols;
    }
  }

  const { EntrezIDsOfTargets, ...otherMetadata } = compoundMetadata;

  const output: CompoundDetailsResponseWSymbols = {
    ...otherMetadata,

    // Explicitly add the new, calculated field
    GeneSymbolOfTargets: geneSymbolOfTargets,
  };

  return output;
}
function getCompoundImageUrl(smiles: string | null): string | null {
  if (smiles === null || smiles === "") {
    return null;
  }

  const encodedSmiles = pythonQuote(smiles);
  const imageUrl = `${compoundImageBaseURL}${encodedSmiles}.svg`;
  return imageUrl;
}

export default function useStructureAndDetailData(compoundId: string) {
  const [
    metadata,
    setMetdata,
  ] = useState<CompoundDetailsResponseWSymbols | null>(null);
  const [structureImageUrl, setStructureImageUrl] = useState<string | null>(
    null
  );
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!compoundId) {
      setMetdata(null);
      setError(false);
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const bbapi = breadboxAPI;

        const columnsOfInterest = [
          "EntrezIDsOfTargets",
          "TargetOrMechanism",
          "SMILES",
          "PubChemCID",
          "ChEMBLID",
        ];

        // Get a mapping of entrez id --> gene symbol
        const geneMetadata = await fetchMetadata<any>(
          "gene",
          null,
          ["label"],
          breadboxAPI,
          "id"
        );

        // Has targets listed as entrez ids
        const compoundDetailMetadata = await fetchMetadata<CompoundDetailsResponse>(
          "compound_v2",
          [compoundId],
          columnsOfInterest,
          bbapi,
          "id"
        );

        // Updates the compound metadata to have targets listed as symbols for the UI
        const compoundMetadataWSymbols = mapEntrezIdToSymbols(
          compoundDetailMetadata,
          geneMetadata
        );

        setMetdata(compoundMetadataWSymbols);

        const smiles = compoundDetailMetadata?.SMILES[compoundId];
        const imgUrl = getCompoundImageUrl(smiles);
        setStructureImageUrl(imgUrl);

        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setMetdata(null);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [compoundId]);

  return { metadata, structureImageUrl, error, isLoading };
}
