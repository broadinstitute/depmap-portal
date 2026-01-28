import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { DatasetAssociations } from "@depmap/types/src/Dataset";
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

interface CompoundMetadata {
  EntrezIDsOfTargets: { [compoundId: string]: string[] | null };
  label: { [compoundId: string]: string | null };
}

/**
 * Pre-calculates a Map of Compound Label -> Set of Gene Symbols.
 */
function getCompoundTargetSymbolMap(
  metadata: CompoundMetadata,
  geneMetadata: any
): Record<string, Set<string>> {
  const targetMap: Record<string, Set<string>> = {};
  const entrezData = metadata.EntrezIDsOfTargets || {};

  Object.entries(entrezData).forEach(([id, entrezIds]) => {
    const label = metadata.label[id];
    if (label && Array.isArray(entrezIds)) {
      const symbols = mapEntrezIdToSymbols(entrezIds, geneMetadata);
      targetMap[label] = new Set(symbols);
    }
  });

  return targetMap;
}

/**
 * Filters and sorts raw correlations into the "Top 2 Targets" and "Top 10 Related Compounds" format.
 */
function getTopCorrelatedData(
  selectedCompoundGeneTargets: string[],
  allCorrelatedCompounds: TargetCorrelatedCompound[],
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">,
  geneMetadata: any,
  allCompoundMetadata: CompoundMetadata
) {
  const selectedTargetsSet = new Set(selectedCompoundGeneTargets);
  const compoundTargetMap = getCompoundTargetSymbolMap(
    allCompoundMetadata,
    geneMetadata
  );

  const topTargets = new Set<string>();
  const topCompounds = new Set<string>();
  const topCorrelates: TopCompoundTargetsCorrelates = {};

  // Sort by strength of relationship
  const sortedData = [...allCorrelatedCompounds].sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  );

  sortedData.forEach((item) => {
    const compoundName = item.other_dimension_label;
    const itemGene = item.gene;
    const candidateTargets = compoundTargetMap[compoundName];

    // Check 1: Does the related compound share any target with the selected compound?
    const hasOverlap =
      candidateTargets &&
      [...selectedTargetsSet].some((t) => candidateTargets.has(t));

    // Check 2: Is the specific gene in this row one of the selected compound's targets?
    const isSelectedTarget = selectedTargetsSet.has(itemGene);

    if (hasOverlap && isSelectedTarget) {
      // Update Top Targets (up to 2)
      if (topTargets.size < 2) {
        topTargets.add(itemGene);
      }

      // Selection Logic for Top 10 Compounds
      const isAlreadyInTop10 = topCompounds.has(compoundName);
      const hasSpaceInTop10 = topCompounds.size < 10;

      if (isAlreadyInTop10 || hasSpaceInTop10) {
        if (!isAlreadyInTop10) {
          topCompounds.add(compoundName);
        }

        // Final Mapping: Only record data if the gene is one of our confirmed Top 2
        if (topTargets.has(itemGene)) {
          const dataTypeKey = datasetToDataTypeMap[item.dataset];

          if (dataTypeKey) {
            if (!topCorrelates[compoundName]) {
              topCorrelates[compoundName] = { CRISPR: {}, RNAi: {} };
            }
            topCorrelates[compoundName][dataTypeKey][itemGene] =
              item.correlation;
          }
        }
      }
    }
  });

  return {
    topCorrelates,
    topTargets: Array.from(topTargets),
    topCompounds: Array.from(topCompounds),
  };
}
export default function useRelatedCompoundsData(
  datasetId: string,
  compoundId: string,
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">
) {
  const bapi = cached(breadboxAPI);

  const [state, setState] = useState({
    isLoading: true,
    hasError: false,
    datasetName: "",
    targetCorrelationData: null as TopCompoundTargetsCorrelates | null,
    topGeneTargets: [] as string[],
    topCompoundCorrelates: [] as string[],
  });

  useEffect(() => {
    (async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, hasError: false }));

        // 1: Metadata Fetching
        const [compoundDataset, allMetadata, geneMetadata] = await Promise.all([
          bapi.getDataset(datasetId),
          fetchMetadata<CompoundMetadata>(
            "compound_v2",
            null,
            ["label", "EntrezIDsOfTargets"],
            breadboxAPI, // fetchMetadata uses cache wrapper internally, so pass in uncached breadboxAPI
            "id"
          ),
          fetchMetadata<any>("gene", null, ["label"], breadboxAPI, "id"),
        ]);

        // selected -> defined by the compound page the user is currently on.
        const selectedEntrez = allMetadata.EntrezIDsOfTargets[compoundId] || [];
        const selectedSymbols = mapEntrezIdToSymbols(
          selectedEntrez,
          geneMetadata
        );

        // 2: Construct Association Query dataset/gene pairs
        const queryPairs = Object.keys(datasetToDataTypeMap).flatMap((dsId) =>
          selectedSymbols.map((gene) => ({ dataset: dsId, gene }))
        );

        const associations = await Promise.allSettled(
          queryPairs.map((p) =>
            bapi.fetchAssociations(
              {
                dataset_id: p.dataset,
                identifier: p.gene,
                identifier_type: "feature_label",
              },
              [datasetId]
            )
          )
        );

        // 3: Flatten and Transform Data
        const allCorrelated = associations
          .filter(
            (r): r is PromiseFulfilledResult<DatasetAssociations> =>
              r.status === "fulfilled"
          )
          .flatMap((r) =>
            r.value.associated_dimensions.map((dim) => ({
              ...dim,
              gene: r.value.dimension_label,
              dataset: r.value.dataset_given_id,
            }))
          );

        const {
          topCorrelates,
          topTargets,
          topCompounds,
        } = getTopCorrelatedData(
          selectedSymbols,
          allCorrelated,
          datasetToDataTypeMap,
          geneMetadata,
          allMetadata
        );

        setState({
          isLoading: false,
          hasError: false,
          datasetName: compoundDataset.name,
          targetCorrelationData: topCorrelates,
          topGeneTargets: topTargets,
          topCompoundCorrelates: topCompounds,
        });
      } catch (e) {
        console.error("Error in useRelatedCompoundsData:", e);
        setState((prev) => ({ ...prev, isLoading: false, hasError: true }));
      }
    })();
  }, [datasetId, compoundId, datasetToDataTypeMap, bapi]);

  return state;
}
