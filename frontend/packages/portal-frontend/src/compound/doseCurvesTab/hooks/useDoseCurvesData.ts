import { Dataset } from "@depmap/types";
import { useEffect, useState, useRef } from "react";
import { getBreadboxApi, getDapi } from "src/common/utilities/context";
import { CompoundDataset } from "src/compound/components/DoseResponseTab";
import { CompoundDoseCurveData, DoseTableRow } from "../types";

function useDoseCurvesData(
  dataset: CompoundDataset | null,
  compoundName: string
) {
  const dapi = getDapi();
  const bbapi = getBreadboxApi();

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [
    doseCurveData,
    setDoseCurveData,
  ] = useState<CompoundDoseCurveData | null>(null);
  const [doseTable, setDoseTable] = useState<DoseTableRow[] | null>(null);

  const latestPromise = useRef<Promise<CompoundDoseCurveData> | null>(null);
  const latestTablePromise = useRef<Promise<any> | null>(null);

  useEffect(() => {
    (async () => {
      if (dataset) {
        setIsLoading(true);

        const promise = dapi.getCompoundDoseCurveData!(
          dataset.dataset,
          dataset.compound_label
        );

        latestPromise.current = promise;
        promise
          .then((fetchedData) => {
            if (promise === latestPromise.current) {
              setDoseCurveData(fetchedData);
            }
          })
          .catch((e) => {
            if (promise === latestPromise.current) {
              window.console.error(e);
              setError(true);
              setIsLoading(false);
            }
          })
          .finally(() => {
            if (promise === latestPromise.current) {
              setIsLoading(false);
            }
          });

        // Get the breadbox data uses compoundName instead of the compound
        // experiment label (see above: dataset.compound_label) used by the legact database to get the dose curve
        // info. Will rename to dataset.compound_exp_label asap to disambiguate
        const compound = compoundName;
        const compoundDimType = await bbapi.getDimensionType("compound_v2");
        if (compoundDimType.metadata_dataset_id) {
          const allCompoundMetadata = await bbapi.getTabularDatasetData(
            compoundDimType.metadata_dataset_id,
            { identifier: "label", columns: ["CompoundID"] }
          );
          const compoundID = allCompoundMetadata["CompoundID"][compound];

          const aucDataset = dataset.dataset;
          // Is there a better way of getting this given id that isn't
          // hard coding???
          const doseViabilityDataset = "Prism_oncology_viability";

          const compoundDoseToDose = new Map();

          const compoundDoseDatasets: [string, string][] = [
            [compoundID, aucDataset],
          ];
          const compoundDoseFeatures = (
            await bbapi.getDatasetFeatures(doseViabilityDataset)
          ).filter((feature) => feature.id.includes(compoundID));
          compoundDoseFeatures.forEach((feature) => {
            const dose = feature.id.replace(compoundID, "").trim();
            compoundDoseToDose.set(feature.id, dose);
            compoundDoseDatasets.push([feature.id, doseViabilityDataset]);
          });

          const featuresData = await bbapi.getFeaturesData(
            doseViabilityDataset,
            compoundDoseFeatures.map((doseFeat) => doseFeat.id)
          );
          console.log({ featuresData });
        }

        const tablePromise = dapi.getDoseResponseTable!(
          dataset.dose_replicate_dataset,
          dataset.compound_xref_full
        );

        latestTablePromise.current = tablePromise;
        tablePromise
          .then((fetchedData) => {
            if (tablePromise === latestTablePromise.current) {
              const modelIds = Object.keys(fetchedData).sort();
              const formattedTableData: DoseTableRow[] = modelIds.map(
                (modelId) => {
                  return { ...fetchedData[modelId], modelId };
                }
              );

              setDoseTable(formattedTableData);
            }
          })
          .catch((e) => {
            if (tablePromise === latestPromise.current) {
              window.console.error(e);
              // setError(true);
              // setIsLoading(false);
            }
          })
          .finally(() => {
            if (tablePromise === latestTablePromise.current) {
              // setIsLoading(false);
            }
          });
      }
    })();
  }, [setDoseCurveData, setIsLoading, dataset, dapi, setDoseTable]);

  return { error, isLoading, doseCurveData, doseTable };
}

export default useDoseCurvesData;
