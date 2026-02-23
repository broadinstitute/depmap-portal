import { breadboxAPI, cached } from "@depmap/api";
import { DatasetAssociations } from "@depmap/types/src/Dataset";
import { useEffect, useState } from "react";

function useTopCoDependenciesData(
  datasetId: string,
  geneEntrezId: string,
  associationDatasetIds: string[]
) {
  const bapi = cached(breadboxAPI);

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [datasetName, setDatasetName] = useState<string>("");
  const [
    correlationData,
    setCorrelationData,
  ] = useState<DatasetAssociations | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);

        const dataset = await bapi.getDataset(datasetId);
        setDatasetName(dataset.name);

        if (dataset.given_id) {
          const datasetAssociations = await bapi.fetchAssociations(
            {
              dataset_id: dataset.given_id,
              identifier: geneEntrezId,
              identifier_type: "feature_id",
            },
            associationDatasetIds
          );
          setCorrelationData(datasetAssociations);
        } else {
          setError(true);
        }
      } catch (e) {
        console.error("Error fetching correlation data:", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [correlationData, geneEntrezId, bapi, datasetId, associationDatasetIds]);
  return {
    datasetName,
    correlationData,
    isLoading,
    error,
  };
}

export default useTopCoDependenciesData;
