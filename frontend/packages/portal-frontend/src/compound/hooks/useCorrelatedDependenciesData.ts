import { DatasetAssociations } from "@depmap/types/src/Dataset";
import { useEffect, useState } from "react";

import { getBreadboxApi } from "src/common/utilities/context";

function useCorrelatedDependenciesData(
  datasetId: string,
  compoundLabel: string
) {
  const bapi = getBreadboxApi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    correlationData,
    setCorrelationData,
  ] = useState<DatasetAssociations | null>(null);
  const [geneTargets, setGeneTargets] = useState<string[]>([]);
  // TBD: I think we actually want to use "CRISPRGeneDependency" instead of Chronos_Combined
  const dataTypeToDatasetMap: Record<string, string> = {
    CRISPR: "Chronos_Combined",
    RNAi: "RNAi_merged",
  };

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
              columns: ["CompoundID", "GeneSymbolOfTargets"],
            }
          );
          const compoundID = allCompoundMetadata.CompoundID[compoundLabel];
          setGeneTargets(
            allCompoundMetadata.GeneSymbolOfTargets[compoundLabel] || []
          );

          // Fetching the correlation data for the given dataset and compound and filtering by associated dataset IDs
          const datasetAssociations = await bapi.fetchAssociations(
            {
              dataset_id: datasetId,
              identifier: compoundID,
              identifier_type: "feature_id",
            },
            Object.values(dataTypeToDatasetMap)
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
    // Only run this effect once when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    correlationData,
    dataTypeToDatasetMap,
    geneTargets,
    isLoading,
    error,
  };
}

export default useCorrelatedDependenciesData;
