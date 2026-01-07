import { breadboxAPI, cached } from "@depmap/api";
import { useEffect, useState } from "react";
import {
  createDoseRangeColorScale,
  transformAndGroupByDataset,
  getAllCorrelates,
} from "../utilities/helper";
import { SortedCorrelations } from "../models/CorrelationPlot";

type FeatureType = "compound" | "gene";

function useCorrelationAnalysisData(
  selectedDataset: any, //  DRCDatasetOptions | GeneCorrelationDatasetOption,
  featureId: string,
  featureName: string,
  featureType: FeatureType
) {
  const bapi = cached(breadboxAPI);

  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [correlatedDatasets, setCorrelatedDatasets] = useState<string[]>([]);
  const [correlationAnalysisData, setCorrelationAnalysisData] = useState<
    SortedCorrelations[]
  >([]);

  const [doseColors, setDoseColors] = useState<
    { hex: string | undefined; dose: string }[]
  >([]);

  useEffect(() => {
    let isCurrent = true;

    (async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        if (featureType === "gene") {
          const res = await bapi.fetchAssociations({
            dataset_id: selectedDataset.datasetId,
            identifier: String(featureId),
            identifier_type: "feature_id",
          });

          if (!isCurrent) return;

          const datasetLookup = res.associated_datasets.reduce((acc, item) => {
            acc[item.dataset_id] = item.name;
            return acc;
          }, {} as Record<string, string>);

          const datasetGivenIdLookup = res.associated_datasets.reduce(
            (acc, item) => {
              acc[item.dataset_id] = item.dataset_given_id;
              return acc;
            },
            {} as Record<string, string>
          );

          // For genes, the "dose" is irrelevant, so we pass an empty map or dummy value
          const dummyDoseMap = new Map([[res.dimension_label, ""]]);

          const associationsByDataset = transformAndGroupByDataset(
            res.associated_dimensions,
            res.dimension_label,
            datasetLookup,
            datasetGivenIdLookup,
            dummyDoseMap
          );

          const featureDatasetCorrelates: Record<
            string,
            Record<string, SortedCorrelations[]>
          > = {};
          Object.entries(associationsByDataset).forEach(([ds, assoc]) => {
            featureDatasetCorrelates[ds] = { [res.dimension_label]: assoc };
          });

          const correlatesData = getAllCorrelates(featureDatasetCorrelates);

          // Filter self-correlations
          const filtered = correlatesData.filter(
            (cor) =>
              cor.feature !== featureName &&
              cor.featureDatasetGivenId !== selectedDataset.datasetId
          );

          setCorrelatedDatasets(Object.keys(featureDatasetCorrelates));
          setCorrelationAnalysisData(filtered);
          setDoseColors([]); // No dose colors for genes
        } else {
          const aucDataset = selectedDataset.log_auc_dataset_given_id!;
          const doseViabilityDataset =
            selectedDataset.viability_dataset_given_id;

          const compoundDoseToDose = new Map();
          const compoundDoseDatasets: [string, string][] = [
            [featureId, aucDataset],
          ];

          const compoundDoseFeatures = (
            await bapi.getDatasetFeatures(doseViabilityDataset)
          ).filter((feature) => feature.id.includes(featureId));

          compoundDoseFeatures.forEach((feature) => {
            const dose = feature.id.replace(featureId, "").trim();
            compoundDoseToDose.set(feature.label, dose);
            compoundDoseDatasets.push([feature.id, doseViabilityDataset]);
          });

          const dosesAndColors = [
            { hex: "#CC4778", dose: "AUC" },
            ...createDoseRangeColorScale(
              Array.from(compoundDoseToDose.values())
            ),
          ];

          if (!isCurrent) return;
          setDoseColors(dosesAndColors);
          compoundDoseToDose.set(featureName, "AUC");

          const allCorrelates = await Promise.all(
            compoundDoseDatasets.map(([f, d]) =>
              bapi.fetchAssociations({
                dataset_id: d,
                identifier: f,
                identifier_type: "feature_id",
              })
            )
          );

          if (!isCurrent) return;

          const featureDatasetDoseCorrelates: Record<
            string,
            Record<string, SortedCorrelations[]>
          > = {};

          allCorrelates.forEach((correlates) => {
            const dsLookup = correlates.associated_datasets.reduce(
              (acc, item) => {
                acc[item.dataset_id] = item.name;
                return acc;
              },
              {} as Record<string, string>
            );
            const dsGivenIdLookup = correlates.associated_datasets.reduce(
              (acc, item) => {
                acc[item.dataset_id] = item.dataset_given_id;
                return acc;
              },
              {} as Record<string, string>
            );

            const grouped = transformAndGroupByDataset(
              correlates.associated_dimensions,
              correlates.dimension_label,
              dsLookup,
              dsGivenIdLookup,
              compoundDoseToDose
            );

            Object.entries(grouped).forEach(([ds, associations]) => {
              if (!featureDatasetDoseCorrelates[ds]) {
                featureDatasetDoseCorrelates[ds] = {};
              }
              const label = correlates.dimension_label;
              featureDatasetDoseCorrelates[ds][label] = (
                featureDatasetDoseCorrelates[ds][label] || []
              ).concat(associations);
            });
          });

          setCorrelatedDatasets(Object.keys(featureDatasetDoseCorrelates));
          const correlatesData = getAllCorrelates(
            featureDatasetDoseCorrelates
          ).filter(
            (cor) =>
              cor.feature !== featureName &&
              cor.featureDatasetGivenId !== aucDataset &&
              cor.featureDatasetGivenId !== doseViabilityDataset
          );

          setCorrelationAnalysisData(correlatesData);
        }
      } catch (e) {
        if (isCurrent) {
          console.error("Error fetching correlation data:", e);
          setHasError(true);
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [featureName, featureId, selectedDataset, bapi, featureType]);

  return {
    correlationAnalysisData,
    correlatedDatasets,
    doseColors,
    isLoading,
    hasError,
  };
}

export default useCorrelationAnalysisData;
