import { useEffect, useRef, useState } from "react";
import { breadboxAPI, legacyPortalAPI, cached } from "@depmap/api";
import { fetchMetadata } from "src/compound/fetchDataHelpers";
import { getDoseRangeLabel, getKeysByValue } from "src/compound/utils";
import { DatasetAvailability } from "src/compound/types";
import { MatrixDataset, DataAvailByAUCDatasetMetadataMap } from "@depmap/types";

/**
 * Build the base URL for the data page.
 */
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

/**
 * Helper function to handle the heavy lifting of data transformation.
 * Batch metadata requests.
 */
const getPrioritizedData = async (
  compoundId: string,
  datasets: MatrixDataset[],
  metadataMap: DataAvailByAUCDatasetMetadataMap
): Promise<DatasetAvailability[]> => {
  const bbapi = breadboxAPI;

  // 1. Map Breadbox datasets by ID
  const breadboxDatasetLookup = Object.fromEntries(
    datasets.map((ds) => [ds.given_id || ds.id, ds])
  );

  const prioritizedIds = Object.keys(metadataMap).filter(
    (id) => !!breadboxDatasetLookup[id]
  );

  // 2. Fetch ALL dose metadata for this compound once.
  const doseCompoundMetadata = await fetchMetadata<{
    CompoundID: Record<string, string>;
  }>("compound_dose", null, ["CompoundID"], bbapi);

  const allViabilityFeatureIds = getKeysByValue(
    doseCompoundMetadata.CompoundID,
    compoundId
  );

  if (allViabilityFeatureIds.length === 0) {
    return [];
  }

  // Batch fetch Dose/Units for every relevant feature found
  const globalDoseMetadata = await fetchMetadata<{
    Dose: Record<string, number>;
    DoseUnit: Record<string, string>;
  }>("compound_dose", allViabilityFeatureIds, ["Dose", "DoseUnit"], bbapi);

  // 3. Process each dataset record
  return Promise.all(
    prioritizedIds.map(async (aucId) => {
      const meta = metadataMap[aucId];
      const bbDataset = breadboxDatasetLookup[aucId];
      const viabilityId = meta.viability_dataset_given_id;

      try {
        // Filter the global metadata to only include features found in this specific viability dataset
        const features = await cached(bbapi).getDatasetFeatures(viabilityId);
        const localFeatureIds = features
          .filter((f: any) => f.id.includes(compoundId))
          .map((f: any) => f.id);

        const localDoseMeta = {
          Dose: Object.fromEntries(
            localFeatureIds.map((id) => [id, globalDoseMetadata.Dose[id]])
          ),
          DoseUnit: Object.fromEntries(
            localFeatureIds.map((id) => [id, globalDoseMetadata.DoseUnit[id]])
          ),
        };

        const doseRange = getDoseRangeLabel(localDoseMeta);
        const sliceData = await cached(bbapi).getMatrixDatasetData(aucId, {
          features: [compoundId],
          feature_identifier: "id",
        });
        const record: Record<string, any> = sliceData[compoundId] || {};

        const dataList = Object.values(record).map(Number).filter(Boolean);

        return {
          datasetDisplayName: meta.display_name,
          datasetUrl: buildDatasetUrl(bbDataset),
          cellLineCount: dataList.length,
          doseRangeLabel: doseRange || "N/A",
          assayLabel: meta.assay,
        };
      } catch (e) {
        console.error(`Error processing dataset ${aucId}:`, e);
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
};

/**
 * Hook to manage data availability state.
 */
export default function useDataAvailabilityTileData(
  compoundId: string,
  datasets: MatrixDataset[]
) {
  const [state, setState] = useState({
    data: [] as DatasetAvailability[],
    error: false,
    isLoading: false,
  });

  // Keep track of the current request ID
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!compoundId || !datasets?.length) {
      setState({ data: [], error: false, isLoading: false });
      return;
    }

    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    setState((prev) => ({ ...prev, isLoading: true, error: false }));

    (async () => {
      try {
        // Fetch labels/mapping from Python/Legacy
        const metadataMap = await cached(
          legacyPortalAPI
        ).getDataAvailabilityMetadata();

        const results = await getPrioritizedData(
          compoundId,
          datasets,
          metadataMap
        );

        // STALE REQUEST GUARD
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setState({ data: results, error: false, isLoading: false });
      } catch (e) {
        window.console.error("Error in Data Availability Hook:", e);
        if (currentRequestId === requestIdRef.current) {
          setState({ data: [], error: true, isLoading: false });
        }
      }
    })();
  }, [compoundId, datasets]);

  return {
    dataAvailabilityData: state.data,
    error: state.error,
    isLoading: state.isLoading,
  };
}
