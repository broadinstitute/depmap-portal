import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { compoundImageBaseURL, pythonQuote } from "src/compound/utils";

interface CompoundDetailsResponse {
  GeneSymbolOfTargets: { [compoundId: string]: string[] };
  TargetOrMechanism: { [compoundId: string]: string };
  SMILES: { [compoundId: string]: string | null };
  PubChemCID: { [compoundId: string]: string };
  ChEMBLID: { [compoundId: string]: string };
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
  const [metadata, setMetdata] = useState<CompoundDetailsResponse | null>(null);
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
          "GeneSymbolOfTargets",
          "TargetOrMechanism",
          "SMILES",
          "PubChemCID",
          "ChEMBLID",
        ];

        const compoundDetailMetadata = await fetchMetadata<CompoundDetailsResponse>(
          "compound_v2",
          [compoundId],
          columnsOfInterest,
          bbapi,
          "id"
        );

        setMetdata(compoundDetailMetadata);

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
