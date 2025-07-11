import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";

export default function useStructureAndDetailData(compoundId: string) {
  const [metadata, setMetdata] = useState<any>(null);
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

        // TODO --> Left off here. Type setMetadata appropriately and fill in
        // the rest of the tile. Need to get the image from legacy db like the
        // older tile did.

        const compoundDetailMetadata = await fetchMetadata<{
          CellLineName: Record<string, string>;
        }>("compound_v2", null, columnsOfInterest, bbapi);

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
