import { breadboxAPI, cached } from "@depmap/api";
import { useEffect, useState } from "react";
import {
  createDoseRangeColorScale,
  transformAndGroupByDataset,
  getAllCorrelates,
} from "../utilities/helper";
import { SortedCorrelations } from "../models/CorrelationPlot";

// we separate this out into a hook. In the future, we may want to reuse this hook for correlation analysis in gene page
function useCorrelationAnalysisData(
  selectedDataset: string,
  featureLabel: string,
  featureType: string,
  featureMetadataCols: string[],
  featureDatasets: { auc: string; viability: string }
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
    (async () => {
      try {
        setIsLoading(true);

        // get compound id by label
        const featureDimType = await bapi.getDimensionType(featureType);
        const idColumn = featureDimType.id_column;
        if (featureDimType.metadata_dataset_id) {
          const allCompoundMetadata = await bapi.getTabularDatasetData(
            featureDimType.metadata_dataset_id,
            {
              identifier: "label",
              columns: featureMetadataCols,
            }
          );
          const compoundID = allCompoundMetadata[idColumn][featureLabel];

          // get selected datasets
          const aucDataset = featureDatasets.auc;
          const doseViabilityDataset = featureDatasets.viability;

          // map compound dose features to their dose measurement
          const compoundDoseToDose = new Map();
          // Map compound dose features to their dataets for fetching later
          const compoundDoseDatasets: [string, string][] = [
            [compoundID, aucDataset], // auc dataset uses compound id as the feature
          ];
          // For viability dataset, get dose features that contain given feature id and extract the dose info from feature
          const compoundDoseFeatures = (
            await bapi.getDatasetFeatures(doseViabilityDataset)
          ).filter((feature) => feature.id.includes(compoundID));
          compoundDoseFeatures.forEach((feature) => {
            const dose = feature.id.replace(compoundID, "").trim();
            compoundDoseToDose.set(feature.id, dose);
            compoundDoseDatasets.push([feature.id, doseViabilityDataset]);
          });

          // assign colors to dose
          const dosesAndColors: { hex: string | undefined; dose: string }[] = [
            { hex: "#CC4778", dose: "AUC" }, // Handle AUC color specially
            ...createDoseRangeColorScale(
              // viability doses will have a color range assigned to them
              Array.from(compoundDoseToDose.values())
            ),
          ];
          setDoseColors(dosesAndColors);
          // NOTE: Order matters here. After assign viability colors add feature mapping for auc dose feature
          compoundDoseToDose.set(featureLabel, "AUC");

          // Fetching the correlation data for the given dataset and compound dose features
          const allCorrelatesForFeatureDataset = await Promise.all(
            compoundDoseDatasets.map(([feature, dataset]) =>
              bapi.fetchAssociations({
                dataset_id: dataset,
                identifier: feature,
                identifier_type: "feature_id",
              })
            )
          );

          // transform correlation data to map of correlated dataset to their associations
          const featureDatasetDoseCorrelates: Record<
            string,
            Record<string, SortedCorrelations[]>
          > = {};
          allCorrelatesForFeatureDataset.forEach((compoundDoseCorrelates) => {
            const datasetLookup = compoundDoseCorrelates.associated_datasets.reduce(
              (acc, item) => {
                acc[item.dataset_id] = item.name;
                return acc;
              },
              {} as Record<string, string>
            );
            const doseAssociationsByFeatureDataset = transformAndGroupByDataset(
              compoundDoseCorrelates.associated_dimensions,
              compoundDoseCorrelates.dimension_label,
              datasetLookup,
              compoundDoseToDose
            );
            Object.entries(doseAssociationsByFeatureDataset).forEach(
              ([featureDataset, associations]) => {
                if (featureDataset in featureDatasetDoseCorrelates) {
                  if (
                    compoundDoseCorrelates.dimension_label in
                    featureDatasetDoseCorrelates[featureDataset]
                  ) {
                    featureDatasetDoseCorrelates[featureDataset][
                      compoundDoseCorrelates.dimension_label
                    ] = featureDatasetDoseCorrelates[featureDataset][
                      compoundDoseCorrelates.dimension_label
                    ].concat(associations);
                  } else {
                    featureDatasetDoseCorrelates[featureDataset][
                      compoundDoseCorrelates.dimension_label
                    ] = associations;
                  }
                } else {
                  featureDatasetDoseCorrelates[featureDataset] = {
                    [compoundDoseCorrelates.dimension_label]: associations,
                  };
                }
              }
            );
          });
          setCorrelatedDatasets(Object.keys(featureDatasetDoseCorrelates));
          const correlatesData = getAllCorrelates(featureDatasetDoseCorrelates);

          // filter out correlated dataset features that match the given featureLabel/compound within the same given dataset (a.k.a features correlated with itself)
          const correlatesDataWithoutSelf = correlatesData.filter(
            (cor) =>
              cor.feature != featureLabel && cor.featureDataset != aucDataset
          );
          setCorrelationAnalysisData(correlatesDataWithoutSelf);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureLabel, selectedDataset]);
  return {
    correlationAnalysisData,
    correlatedDatasets,
    doseColors,
    isLoading,
    hasError,
  };
}

export default useCorrelationAnalysisData;
