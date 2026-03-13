import { useEffect, useState } from "react";
import { breadboxAPI, legacyPortalAPI, cached } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { getDoseRangeLabel } from "src/compound/utils";
import { DatasetAvailability } from "src/compound/types";
import { MatrixDataset } from "@depmap/types";

/**
 * Fetches and constructs a dose range label for a specific compound within a dataset.
 */
export async function fetchDoseRangeLabel(
  compoundId: string,
  viabilityDatasetId: string
): Promise<string | null> {
  const bapi = breadboxAPI;

  try {
    const features = await cached(bapi).getDatasetFeatures(viabilityDatasetId);

    const viabilityFeatureIds = features
      .filter((f: any) => f.id.includes(compoundId))
      .map((f: any) => f.id);

    if (viabilityFeatureIds.length === 0) {
      return null;
    }

    const doseMetadata = await fetchMetadata<{
      Dose: Record<string, number>;
      DoseUnit: Record<string, string>;
    }>("compound_dose", viabilityFeatureIds, ["Dose", "DoseUnit"], bapi);

    return getDoseRangeLabel(doseMetadata);
  } catch (error) {
    console.error(
      `Error fetching dose range for ${viabilityDatasetId}:`,
      error
    );
    return null;
  }
}

// Logic to build the base URL for the data page
const dataPageHref = `${
  window.location.href.split(encodeURIComponent("compound"))[0]
}data_page`;

const buildDatasetUrl = (dataset: MatrixDataset) => {
  const fileInfo = dataset.dataset_metadata?.download_file_info;

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
    // Basic guard clause
    if (!compoundId || !datasets || datasets.length === 0) {
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
        const lapi = legacyPortalAPI;

        // 1. Fetch the metadata map from the legacy DB
        const metadataMap = await cached(lapi).getDataAvailabilityMetadata();

        // 2. Map Breadbox datasets by ID for quick lookup
        const breadboxDatasetLookup: Record<string, MatrixDataset> = {};
        datasets.forEach((ds) => {
          const id = ds.given_id || ds.id;
          breadboxDatasetLookup[id] = ds;
        });

        // 3. Process only the datasets that appear in our Metadata Map
        // AND are present in the Breadbox datasets list
        const prioritizedIds = Object.keys(metadataMap).filter(
          (id) => !!breadboxDatasetLookup[id]
        );

        const datasetStats = await Promise.all(
          prioritizedIds.map(async (aucId) => {
            const meta = metadataMap[aucId];
            const bbDataset = breadboxDatasetLookup[aucId];

            try {
              // Retrieve specific dose range for this dataset's viability dataset
              const doseRange = await fetchDoseRangeLabel(
                compoundId,
                meta.viability_dataset_given_id
              );

              // Get sample (cell line) count
              const samples = await cached(bbapi).getDatasetSamples(aucId);

              return {
                datasetDisplayName: meta.display_name,
                datasetUrl: buildDatasetUrl(bbDataset),
                cellLineCount: samples.length,
                doseRangeLabel: doseRange || "N/A",
                assayLabel: meta.assay,
              };
            } catch (e) {
              console.error(`Error fetching data for ${meta.display_name}:`, e);
              // Return a partial object so the row still shows up, but with error placeholders
              return {
                datasetDisplayName: meta.display_name,
                datasetUrl: buildDatasetUrl(bbDataset) || "#",
                cellLineCount: 0,
                doseRangeLabel: "N/A",
                assayLabel: meta.assay || "N/A",
              };
            }
          })
        );

        setDataAvailabilityData(datasetStats);
      } catch (e) {
        window.console.error("Error in Data Availability Hook:", e);
        setDataAvailabilityData([]);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [compoundId, datasets]);

  return { dataAvailabilityData, error, isLoading };
}
