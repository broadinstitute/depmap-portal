import { breadboxAPI, cached } from "@depmap/api";
import { DatasetAssociations } from "@depmap/types/src/Dataset";
import { useEffect, useState } from "react";
import useCompoundMetadata from "./useCompoundMetadata";

function useRelatedCompoundsData(
  datasetId: string, // TODO: This can probably be hardcoded if only used in tile
  compoundLabel: string
) {
  const bapi = cached(breadboxAPI);

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [targetCorrelationData, setTargetCorrelationData] = useState<
    any | null
  >(null);
  const [topGeneTargets, setTopGeneTargets] = useState<string[]>([]);
  const [topCompoundCorrelates, setTopCompoundCorrelates] = useState<string[]>(
    []
  );

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
          const targetGenes =
            allCompoundMetadata.GeneSymbolOfTargets[compoundLabel] || [];

          // make a list of dataset and gene target pairs to query by
          const datasetGenePairs = Object.values(
            dataTypeToDatasetMap
          ).flatMap((dataset) =>
            targetGenes.map((gene) => ({ dataset, gene }))
          );

          // Here we are getting slices for each gene target in crispr and rnai datasets correlated with Oncref
          const datasetTargetCorrelates: DatasetAssociations[] = [];
          const targetCorrelates = await Promise.allSettled(
            datasetGenePairs.map(({ dataset, gene }) =>
              bapi.fetchAssociations(
                {
                  dataset_id: dataset,
                  identifier: gene,
                  identifier_type: "feature_label",
                },
                [datasetId]
              )
            )
          ).then((
            results // unsure if each gene target exists in dataset so let's process them separately
          ) =>
            results.forEach((result) => {
              if (result.status === "fulfilled") {
                datasetTargetCorrelates.push(result.value);
              }
              console.log(result.status);
            })
          );
          // Flatten all associated compounds for all datasets
          const allCorrelatedCompounds = datasetTargetCorrelates.flatMap((c) =>
            c.associated_dimensions.map((dim) => ({
              ...dim,
              gene: c.dimension_label,
              dataset: c.dataset_given_id,
            }))
          );
          // Sort by correlation
          allCorrelatedCompounds.sort((a, b) => b.correlation - a.correlation);

          // Get top 2 gene targets by correlation bc that's how much space we can realistically show in tile. Note JS sets preserve insertion order so targets should be sorted by correlation already from earlier
          const topTargets: Set<string> = new Set();

          // Get top 10 overall compounds across all datasets
          const topCompounds: Set<string> = new Set();

          // filter all correlates by those in topTargets and topCompound
          const filteredTopCorrelates = [];
          const topCorrelates: {
            [compoundName: string]: {
              CRISPR: { [targetName: string]: number };
              RNAi: { [targetName: string]: number };
            };
          } = {};
          for (let i = 0; i < allCorrelatedCompounds.length; i++) {
            const correlatedCompound = allCorrelatedCompounds[i];

            const correlatedCompoundGeneTarget = correlatedCompound.gene;
            if (topTargets.size < 2) {
              if (!topTargets.has(correlatedCompoundGeneTarget)) {
                topTargets.add(correlatedCompoundGeneTarget);
              }
            }

            const correlatedCompoundName =
              correlatedCompound.other_dimension_label;
            if (topCompounds.size < 10) {
              if (!topCompounds.has(correlatedCompoundName)) {
                topCompounds.add(correlatedCompoundName);
              }
            }
            if (
              topCompounds.has(correlatedCompoundName) &&
              topTargets.has(correlatedCompoundGeneTarget)
            ) {
              filteredTopCorrelates.push(correlatedCompound);
              const dataTypeKey = Object.keys(dataTypeToDatasetMap).find(
                (key) =>
                  dataTypeToDatasetMap[key] === correlatedCompound.dataset
              );
              if (!(correlatedCompoundName in topCorrelates)) {
                topCorrelates[correlatedCompoundName] = {
                  CRISPR: {},
                  RNAi: {},
                };
              }
              topCorrelates[correlatedCompoundName][dataTypeKey][
                correlatedCompound.gene
              ] = correlatedCompound.correlation;
            }
          }
          setTargetCorrelationData(topCorrelates);
          setTopGeneTargets(Array.from(topTargets));
          setTopCompoundCorrelates(Array.from(topCompounds));
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
    targetCorrelationData,
    topGeneTargets,
    topCompoundCorrelates,
    dataTypeToDatasetMap,
    isLoading,
    error,
  };
}

export default useRelatedCompoundsData;
