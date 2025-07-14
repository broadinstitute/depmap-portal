import { useEffect, useState } from "react";
import { breadboxAPI, legacyPortalAPI } from "@depmap/api";
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
        const dapi = legacyPortalAPI; // only need the legacy api to get the structure image

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

        // Get structure image
        const strucImg = await dapi.getStructureImageUrl(compoundId);
        setStructureImageUrl(strucImg);

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
