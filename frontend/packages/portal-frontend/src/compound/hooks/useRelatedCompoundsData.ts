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

function hasIntersection(listA: string[], listB: string[]): boolean {
  const [smaller, larger] =
    listA.length < listB.length ? [listA, listB] : [listB, listA];

  const smallerSet = new Set(smaller);
  return larger.some((item) => smallerSet.has(item));
}

function getTopCorrelatedData(
  selectedCompoundGeneTargets: string[],
  allCorrelatedCompounds: TargetCorrelatedCompound[],
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">,
  geneMetadata: any,
  allCompoundMetadata: any
) {
  // Get top 2 gene targets by correlation bc that's how much space we can realistically show in tile.
  // Note JS sets preserve insertion order so targets should be sorted by correlation already from earlier
  const topTargets: Set<string> = new Set();

  // Get top 10 overall compounds across all datasets
  const topCompounds: Set<string> = new Set();

  // filter all sorted correlations by those that would be in topTargets and topCompound
  const topCorrelates: TopCompoundTargetsCorrelates = {};
  for (let i = 0; i < allCorrelatedCompounds.length; i++) {
    // "possibleRelatedCompound" is defined as the dataset/gene target of interest is associated with this compound, but this
    // compound does not necessarily target one of our top 2 target genes for the selected compound, which is a requirement for
    // being included in the y axis compounds.
    const possibleRelatedCompound = allCorrelatedCompounds[i];
    const possibleRelatedCompoundName =
      possibleRelatedCompound.other_dimension_label;

    // There appears to be an assumption that this stores a gene targeted by the "correlatedCompound".This is FALSE, though
    // const correlatedCompoundGeneTarget = correlatedCompound.gene;

    // Does the compound in question share a gene target with the selected compound? If not, we don't want to keep analyzing it for y axis inclusion.
    const possibleRelatedCompoundGeneTargets = allCompoundMetadata
      .EntrezIDsOfTargets[possibleRelatedCompoundName]
      ? mapEntrezIdToSymbols(
          allCompoundMetadata.EntrezIDsOfTargets[possibleRelatedCompoundName],
          geneMetadata
        )
      : [];
    if (
      hasIntersection(
        possibleRelatedCompoundGeneTargets,
        selectedCompoundGeneTargets
      )
    ) {
      // Why would we add a topTarget that the selected compound is not targeting? The rule seems to be
      // we want the topTargets to definitely be target by the selected compound AND all y axis compounds
      if (topTargets.size < 2) {
        if (!topTargets.has(possibleRelatedCompound.gene)) {
          topTargets.add(possibleRelatedCompound.gene);
        }
      }

      if (topCompounds.size < 10) {
        // for this correlate, add its correlated compound to topCompounds list if it isn't there and if correlated gene target is in topTargets list
        if (!topCompounds.has(possibleRelatedCompoundName)) {
          topCompounds.add(possibleRelatedCompoundName);
        }
      }
      // for this correlate, if it is in topCompounds and topTargets, add it to its respective gene target's dataset data type
      if (topCompounds.has(possibleRelatedCompoundName)) {
        const dataTypeKey =
          datasetToDataTypeMap[possibleRelatedCompound.dataset];

        if (!(possibleRelatedCompoundName in topCorrelates)) {
          topCorrelates[possibleRelatedCompoundName] = {
            CRISPR: {},
            RNAi: {},
          };
        }
        topCorrelates[possibleRelatedCompoundName][dataTypeKey][
          possibleRelatedCompound.gene
        ] = possibleRelatedCompound.correlation;
      }
    }
  }
  return { topCorrelates, topTargets, topCompounds };
}

function useRelatedCompoundsData(
  datasetId: string, // should be a compound dataset. Could be hardcoded instead of param..
  compoundLabel: string,
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

        // get gene targets for given compound
        const compoundDimType = await bapi.getDimensionType("compound_v2");
        if (compoundDimType.metadata_dataset_id) {
          const allCompoundMetadata = await bapi.getTabularDatasetData(
            compoundDimType.metadata_dataset_id,
            {
              identifier: "label",
              columns: ["CompoundID", "EntrezIDsOfTargets"],
            }
          );
          const targetEntrezIDs: string[] =
            allCompoundMetadata.EntrezIDsOfTargets[compoundLabel] || [];

          const geneMetadata = await fetchMetadata<any>(
            "gene",
            null,
            ["label"],
            breadboxAPI,
            "id"
          );

          const targetGenes = mapEntrezIdToSymbols(
            targetEntrezIDs,
            geneMetadata
          );

          // make a list of datasets to correlate and gene target pairs to query by (ex: {dataset1, gene1}, {dataset2, gene1}, {dataset1, gene2}, {dataset2, gene2})
          const datasetGenePairs = Object.keys(
            datasetToDataTypeMap
          ).flatMap((dataset) =>
            targetGenes.map((gene) => ({ dataset, gene }))
          );

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
              // unsure if each gene target exists in dataset so let's process them separately
              // NOTE: We are making the above assumption for when an error occurs..
              console.log(result);
              if (result.status === "fulfilled") {
                datasetTargetCorrelates.push(result.value);
              }
            })
          );

          // BUG --> the above just means the dataset has ONE of the target genes. It does not mean the compound correlate
          // actually targets the gene.

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
        } else {
          console.error(
            "Compound dimension type does not have a metadata dataset ID."
          );
          setHasError(true);
        }
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
