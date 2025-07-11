import { useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";

interface CompoundDetailsResponse {
  GeneSymbolOfTargets: { [compoundId: string]: string[] };
  TargetOrMechanism: { [compoundId: string]: string };
  SMILES: { [compoundId: string]: string };
  PubChemCID: { [compoundId: string]: string };
  ChEMBLID: { [compoundId: string]: string };
}

export default function useStructureAndDetailData(compoundId: string) {
  const [metadata, setMetdata] = useState<CompoundDetailsResponse | null>(null);
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
        console.log(compoundDetailMetadata);
        setMetdata(compoundDetailMetadata);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setMetdata(null);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [compoundId]);

  return { metadata, error, isLoading };
}
