import { useEffect, useState } from "react";
import { breadboxAPI, legacyPortalAPI, cached } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { getDoseRangeLabel, getKeysByValue } from "src/compound/utils";
import { MatrixDataset } from "@depmap/types";
import { DatasetAvailability } from "src/compound/types";

const dataPageHref = `${
  window.location.href.split(encodeURIComponent("compound"))[0]
}data_page`;

const buildDatasetUrl = (dataset: MatrixDataset) => {
  const fileInfo = dataset.dataset_metadata?.download_file_info;

  // If either required piece of info is missing, return null
  if (!fileInfo?.release_name || !fileInfo?.file_name) {
    return null;
  }

  return `${dataPageHref}/?tab=allData&releasename=${encodeURIComponent(
    fileInfo.release_name
  )}&filename=${encodeURIComponent(fileInfo.file_name)}`;
};

export default function useDataAvailabilityTileData(
  compoundId: string,
  datasets: MatrixDataset[]
) {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dataAvailabilityData, setDataAvailabilityData] = useState<
    DatasetAvailability[]
  >([]);

  useEffect(() => {
    if (!compoundId || !datasets) {
      setDataAvailabilityData([]);
      setError(false);
      setIsLoading(false);
      return;
    }

    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const bbapi = breadboxAPI;

        // Get the compound dose viability features by fetching the compound dose metadata. Will
        // be like {CompoundID: "viability_feature_id": "compound_id"}
        const doseCompoundMetadata = await fetchMetadata<{
          CompoundID: Record<string, string>;
        }>("compound_dose", null, ["CompoundID"], bbapi);

        // All of the viability features relevant to this particular compound will be the list of keys
        // with a value equal to this compoundId.
        const viabilityFeatureIds = getKeysByValue(
          doseCompoundMetadata.CompoundID,
          compoundId
        );

        if (viabilityFeatureIds.length === 0) {
          setDataAvailabilityData([]);
          setIsLoading(false);
          throw new Error("No viability data found.");
        }

        const doseMetadata = await fetchMetadata<{
          Dose: Record<string, number>;
          DoseUnit: Record<string, string>;
        }>("compound_dose", viabilityFeatureIds, ["Dose", "DoseUnit"], bbapi);

        const doseRange = getDoseRangeLabel(doseMetadata);

        const assayInfo = cached(legacyPortalAPI).getDataAvailabilityMetadata();

        const datasetStats = await Promise.all(
          datasets.map(async (dataset) => {
            try {
              // Fetch data for this specific dataset
              const samples = await cached(bbapi).getDatasetSamples(
                dataset.given_id || dataset.id
              );

              const count = samples.length;
              return {
                datasetDisplayName: dataset.name,
                // Update this URL pattern to match your routing structure
                datasetUrl: buildDatasetUrl(dataset),
                cellLineCount: count,
                doseRangeLabel: doseRange || "",
                // Fallback to "Viability" if assay metadata isn't on the dataset object
                assayLabel: (dataset as any).assay_type || "Viability",
              };
            } catch (e) {
              console.error(`Error fetching data for ${dataset.name}:`, e);
              return {
                datasetDisplayName: dataset.name,
                datasetUrl: "#",
                cellLineCount: 0,
                doseRangeLabel: doseRange || "",
                assayLabel: "N/A",
              };
            }
          })
        );

        setDataAvailabilityData(datasetStats);
        setIsLoading(false);
      } catch (e) {
        window.console.error(e);
        setDataAvailabilityData([]);
        setError(true);
        setIsLoading(false);
      }
    })();
  }, [compoundId, datasets]);

  return { dataAvailabilityData, error, isLoading };
}
