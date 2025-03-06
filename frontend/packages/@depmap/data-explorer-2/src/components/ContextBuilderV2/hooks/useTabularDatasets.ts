import { useEffect, useState } from "react";
import { AnnotationType, TabularDataset } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { fetchMetadataAndOtherTabularDatasets } from "../../../utils/api-helpers";
import { useContextBuilderState } from "../state/ContextBuilderState";

export default function useTabularDatasets() {
  const api = useDataExplorerApi();
  const { dimension_type } = useContextBuilderState();

  const [metadataDataset, setMetadataDataset] = useState<TabularDataset>();
  const [otherTabularDatasets, setOtherTabularDatasets] = useState<
    TabularDataset[]
  >([]);
  const [isLoadingTabularDatasets, setIsLoadingTabularDatasets] = useState(
    true
  );

  useEffect(() => {
    (async () => {
      // TODO: Add support for type "list_strings"
      const acceptedColTypes = [
        "text" as AnnotationType,
        "categorical" as AnnotationType,
      ];

      const {
        metadataDataset: metaDs,
        otherTabularDatasets: others,
      } = await fetchMetadataAndOtherTabularDatasets(
        api,
        dimension_type,
        acceptedColTypes
      );

      setMetadataDataset(metaDs);
      setOtherTabularDatasets(others);
      setIsLoadingTabularDatasets(false);
    })();
  }, [api, dimension_type]);

  return {
    metadataDataset,
    otherTabularDatasets,
    isLoadingTabularDatasets,
  };
}
