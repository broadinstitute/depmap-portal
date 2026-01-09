import { breadboxAPI, cached } from "@depmap/api";
import { useEffect, useState } from "react";
import {
  createDoseRangeColorScale,
  transformAndGroupByDataset,
  getAllCorrelates,
} from "../utilities/helper";
import { SortedCorrelations } from "../models/CorrelationPlot";
import { DRCDatasetOptions } from "@depmap/types";
import { GeneCorrelationDatasetOption } from "../types";

interface CorrelationResult {
  correlationAnalysisData: SortedCorrelations[];
  correlatedDatasets: string[];
  doseColors: { hex: string | undefined; dose: string }[];
  isLoading: boolean;
  hasError: boolean;
}

export function useGeneCorrelationData(
  selectedDataset: GeneCorrelationDatasetOption,
  featureId: string,
  featureName: string
) {
  const bapi = cached(breadboxAPI);
  const [state, setState] = useState<CorrelationResult>({
    correlationAnalysisData: [],
    correlatedDatasets: [],
    doseColors: [],
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    let isCurrent = true;

    (async () => {
      try {
        setState((s) => ({ ...s, isLoading: true, hasError: false }));

        const res = await bapi.fetchAssociations({
          dataset_id: selectedDataset.datasetId,
          identifier: String(featureId),
          identifier_type: "feature_id",
        });

        if (!isCurrent) return;

        const datasetLookup: Record<string, string> = {};
        const datasetGivenIdLookup: Record<string, string> = {};
        const datasetNameToGivenIdLookup: Record<string, string> = {}; // For filtering the selected dataset out of the Correlate Datasets dropdown options

        res.associated_datasets.forEach((ds: any) => {
          datasetLookup[ds.dataset_id] = ds.name;
          datasetGivenIdLookup[ds.dataset_id] = ds.dataset_given_id;
          datasetNameToGivenIdLookup[ds.name] = ds.dataset_given_id;
        });

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

        const rawCorrelates = getAllCorrelates(featureDatasetCorrelates);

        const filtered = rawCorrelates.filter(
          (cor: SortedCorrelations) =>
            cor.feature !== featureName &&
            cor.featureDatasetGivenId !== selectedDataset.datasetId
        );

        setState({
          correlationAnalysisData: filtered,
          correlatedDatasets: Object.keys(featureDatasetCorrelates).filter(
            (datasetName) =>
              selectedDataset.datasetId !==
              datasetNameToGivenIdLookup[datasetName]
          ),
          doseColors: [],
          isLoading: false,
          hasError: false,
        });
      } catch (e) {
        if (isCurrent) {
          console.error(e);
          setState((s) => ({ ...s, isLoading: false, hasError: true }));
        }
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [selectedDataset, featureId, featureName, bapi]);

  return { ...state };
}

export function useCompoundCorrelationData(
  selectedDataset: DRCDatasetOptions,
  featureId: string,
  featureName: string
): CorrelationResult {
  const bapi = cached(breadboxAPI);
  const [state, setState] = useState<CorrelationResult>({
    correlationAnalysisData: [],
    correlatedDatasets: [],
    doseColors: [],
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    let isCurrent = true;

    (async () => {
      try {
        setState((s) => ({ ...s, isLoading: true, hasError: false }));

        const aucId = selectedDataset.log_auc_dataset_given_id!;
        const doseId = selectedDataset.viability_dataset_given_id;

        const compoundDoseToDose = new Map<string, string>();
        const fetchTasks: [string, string][] = [[featureId, aucId]];

        const features = await bapi.getDatasetFeatures(doseId);
        features
          .filter((f: any) => f.id.includes(featureId))
          .forEach((f: any) => {
            const dose = f.id.replace(featureId, "").trim();
            compoundDoseToDose.set(f.label, dose);
            fetchTasks.push([f.id, doseId]);
          });

        const colors = [
          { hex: "#CC4778", dose: "AUC" },
          ...createDoseRangeColorScale(Array.from(compoundDoseToDose.values())),
        ];

        if (!isCurrent) return;
        compoundDoseToDose.set(featureName, "AUC");

        const allRes = await Promise.all(
          fetchTasks.map(([feature_id, dataset_id]) =>
            bapi.fetchAssociations({
              dataset_id,
              identifier: feature_id,
              identifier_type: "feature_id",
            })
          )
        );

        if (!isCurrent) return;

        const featureDatasetDoseCorrelates: Record<
          string,
          Record<string, SortedCorrelations[]>
        > = {};

        const datasetNameToGivenIdLookup: Record<string, string> = {}; // For filtering the selected dataset out of the Correlate Datasets dropdown options
        allRes.forEach((correlates: any) => {
          const dsLookup: Record<string, string> = {};
          const dsGivenIdLookup: Record<string, string> = {};

          correlates.associated_datasets.forEach((item: any) => {
            dsLookup[item.dataset_id] = item.name;
            dsGivenIdLookup[item.dataset_id] = item.dataset_given_id;

            // Only add to the lookup if the key doesn't already exist
            if (!(item.name in datasetNameToGivenIdLookup)) {
              datasetNameToGivenIdLookup[item.name] = item.dataset_given_id;
            }
          });

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

        const finalData = getAllCorrelates(featureDatasetDoseCorrelates).filter(
          (cor: SortedCorrelations) =>
            cor.feature !== featureName &&
            cor.featureDatasetGivenId !== aucId &&
            cor.featureDatasetGivenId !== doseId
        );

        setState({
          correlationAnalysisData: finalData,
          correlatedDatasets: Object.keys(featureDatasetDoseCorrelates).filter(
            (datasetLabel) =>
              datasetNameToGivenIdLookup[datasetLabel] !== aucId &&
              datasetNameToGivenIdLookup[datasetLabel] !== doseId
          ),
          doseColors: colors,
          isLoading: false,
          hasError: false,
        });
      } catch (e) {
        if (isCurrent) {
          setState((s) => ({ ...s, isLoading: false, hasError: true }));
        }
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [selectedDataset, featureId, featureName, bapi]);

  return state;
}
