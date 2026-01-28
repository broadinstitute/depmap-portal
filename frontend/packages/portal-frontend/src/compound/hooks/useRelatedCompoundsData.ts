import { breadboxAPI, cached } from "@depmap/api";
import { DatasetAssociations } from "@depmap/types/src/Dataset";
import { useEffect, useState } from "react";
import { fetchMetadata } from "../fetchDataHelpers";
import { mapEntrezIdToSymbols } from "../utils";

interface TargetCorrelatedCompound {
  gene: string;
  dataset: string;
  correlation: number;
  log10qvalue: number;
  other_dataset_id: string;
  other_dataset_given_id: string;
  other_dimension_given_id: string;
  other_dimension_label: string;
}

interface TopCompoundTargetsCorrelates {
  [compoundName: string]: {
    CRISPR: { [targetName: string]: number };
    RNAi: { [targetName: string]: number };
  };
}

interface CompoundMetadataOfInterest {
  EntrezIDsOfTargets: { [compoundId: string]: string[] | null };
  label: { [compoundId: string]: string | null }; // compound_id (i.e. DPC-00001)
}

function getCompoundTargetSymbolMap(
  allCompoundMetadata: CompoundMetadataOfInterest,
  geneMetadata: any
): Record<string, Set<string>> {
  const targetMap: Record<string, Set<string>> = {};
  const entrezData = allCompoundMetadata.EntrezIDsOfTargets || {};

  Object.entries(entrezData).forEach(([compoundId, entrezIds]) => {
    const label = allCompoundMetadata.label[compoundId];

    if (label && Array.isArray(entrezIds)) {
      const symbols = mapEntrezIdToSymbols(entrezIds, geneMetadata);
      targetMap[label] = new Set(symbols);
    }
  });

  return targetMap;
}

function getTopCorrelatedData(
  selectedCompoundGeneTargets: string[],
  allCorrelatedCompounds: TargetCorrelatedCompound[],
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">,
  geneMetadata: any,
  allCompoundMetadata: CompoundMetadataOfInterest
) {
  const selectedTargetsSet = new Set(selectedCompoundGeneTargets);
  const compoundTargetSymbolMap = getCompoundTargetSymbolMap(
    allCompoundMetadata,
    geneMetadata
  );

  const topTargets: Set<string> = new Set();
  const topCompounds: Set<string> = new Set();
  const topCorrelates: TopCompoundTargetsCorrelates = {};

  const sortedData = [...allCorrelatedCompounds].sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  );

  for (const item of sortedData) {
    const compoundName = item.other_dimension_label;
    const itemGene = item.gene;

    const compoundTargets = compoundTargetSymbolMap[compoundName];
    if (compoundTargets) {
      let sharesTarget = false;
      for (const target of selectedTargetsSet) {
        if (compoundTargets.has(target)) {
          sharesTarget = true;
          break;
        }
      }

      if (sharesTarget) {
        if (topTargets.size < 2) {
          topTargets.add(itemGene);
        }

        if (topCompounds.size < 10 || topCompounds.has(compoundName)) {
          if (!topCompounds.has(compoundName) && topCompounds.size < 10) {
            topCompounds.add(compoundName);
          }

          // Only add data if it belongs to one of our top 2 targets
          if (topCompounds.has(compoundName) && topTargets.has(itemGene)) {
            const dataTypeKey = datasetToDataTypeMap[item.dataset];

            if (!topCorrelates[compoundName]) {
              topCorrelates[compoundName] = { CRISPR: {}, RNAi: {} };
            }

            topCorrelates[compoundName][dataTypeKey][itemGene] =
              item.correlation;
          }
        }
      }
    }
  }

  return { topCorrelates, topTargets, topCompounds };
}
function useRelatedCompoundsData(
  datasetId: string, // should be a compound dataset. Could be hardcoded instead of param..
  compoundId: string,
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">
) {
  const bapi = cached(breadboxAPI);

  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [datasetName, setDatasetName] = useState<string>("");
  const [
    targetCorrelationData,
    setTargetCorrelationData,
  ] = useState<TopCompoundTargetsCorrelates | null>(null);
  const [topGeneTargets, setTopGeneTargets] = useState<string[]>([]);
  const [topCompoundCorrelates, setTopCompoundCorrelates] = useState<string[]>(
    []
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        // get compound dataset name
        const compoundDataset = await bapi.getDataset(datasetId);
        setDatasetName(compoundDataset.name);

        const allCompoundMetadata = await fetchMetadata<CompoundMetadataOfInterest>(
          "compound_v2",
          null,
          ["label", "EntrezIDsOfTargets"],
          bapi,
          "id"
        );

        const targetEntrezIDs: string[] =
          allCompoundMetadata.EntrezIDsOfTargets[compoundId] || [];

        const geneMetadata = await fetchMetadata<any>(
          "gene",
          null, // Get all metadata to use for comparing selected compound gene target symbols and possibleRelatedCompound target symbols
          ["label"],
          breadboxAPI,
          "id"
        );

        const targetGenes = mapEntrezIdToSymbols(targetEntrezIDs, geneMetadata);

        // make a list of datasets to correlate and gene target pairs to query by (ex: {dataset1, gene1}, {dataset2, gene1}, {dataset1, gene2}, {dataset2, gene2})
        const datasetGenePairs = Object.keys(
          datasetToDataTypeMap
        ).flatMap((dataset) => targetGenes.map((gene) => ({ dataset, gene })));

        // Here we are getting slices for each gene target in crispr and rnai datasets correlated with given compound dataset (Oncref)
        const datasetTargetCorrelates: DatasetAssociations[] = [];
        await Promise.allSettled(
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
        ).then((results) =>
          results.forEach((result) => {
            if (result.status === "fulfilled") {
              datasetTargetCorrelates.push(result.value);
            }
          })
        );

        // Flatten all associated compounds from correlated datasets with gene targets
        const allCorrelatedCompounds = datasetTargetCorrelates.flatMap((c) =>
          c.associated_dimensions.map((dim) => ({
            ...dim,
            gene: c.dimension_label,
            dataset: c.dataset_given_id,
          }))
        );
        // Sort by correlation
        allCorrelatedCompounds.sort((a, b) => b.correlation - a.correlation);

        const {
          topCorrelates,
          topTargets,
          topCompounds,
        } = getTopCorrelatedData(
          targetGenes,
          allCorrelatedCompounds,
          datasetToDataTypeMap,
          geneMetadata,
          allCompoundMetadata
        );
        setTargetCorrelationData(topCorrelates);
        setTopGeneTargets(Array.from(topTargets));
        setTopCompoundCorrelates(Array.from(topCompounds));
      } catch (e) {
        console.error("Error fetching correlation data:", e);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    })();
    // Only run this effect once when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    datasetName,
    targetCorrelationData,
    topGeneTargets,
    topCompoundCorrelates,
    isLoading,
    hasError,
  };
}

export default useRelatedCompoundsData;
