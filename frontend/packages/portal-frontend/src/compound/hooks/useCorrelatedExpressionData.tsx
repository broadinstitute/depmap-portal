import { breadboxAPI, cached } from "@depmap/api";
import { DatasetAssociations } from "@depmap/types/src/Dataset";
import { useEffect, useState } from "react";
import { mapEntrezIdToSymbols } from "../utils";
import { fetchMetadata } from "../fetchDataHelpers";

function useCorrelatedExpressionData(
  datasetId: string,
  compoundLabel: string,
  associationDatasetId: string
) {
  const bapi = cached(breadboxAPI);

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    correlationData,
    setCorrelationData,
  ] = useState<DatasetAssociations | null>(null);
  const [geneTargets, setGeneTargets] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);

        // get compound id by label
        const compoundDimType = await bapi.getDimensionType("compound_v2");
        if (compoundDimType.metadata_dataset_id) {
          const allCompoundMetadata = await bapi.getTabularDatasetData(
            compoundDimType.metadata_dataset_id,
            {
              identifier: "label",
              columns: ["CompoundID", "EntrezIDsOfTargets"],
            }
          );
          const compoundID = allCompoundMetadata.CompoundID[compoundLabel];

          const geneMetadata = await fetchMetadata<any>(
            "gene",
            null,
            ["label"],
            breadboxAPI,
            "id"
          );

          const genes = mapEntrezIdToSymbols(
            allCompoundMetadata.EntrezIDsOfTargets[compoundLabel] || [],
            geneMetadata
          );
          setGeneTargets(genes);

          // Fetching the correlation data for the given dataset and compound and filtering by associated dataset IDs
          const datasetAssociations = await bapi.fetchAssociations(
            {
              dataset_id: datasetId,
              identifier: compoundID,
              identifier_type: "feature_id",
            },
            [associationDatasetId]
          );

          setCorrelationData(datasetAssociations);
        } else {
          console.error(
            "Compound dimension type does not have a metadata dataset ID."
          );
          setError(true);
        }
      } catch (e) {
        console.error("Error fetching correlation data:", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [associationDatasetId, correlationData, compoundLabel, bapi, datasetId]);
  return {
    correlationData,
    geneTargets,
    isLoading,
    error,
  };
}

export default useCorrelatedExpressionData;
