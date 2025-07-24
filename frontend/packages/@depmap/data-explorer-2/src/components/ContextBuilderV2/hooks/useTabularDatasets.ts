import { useEffect, useState } from "react";
import { AnnotationType, TabularDataset } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";
import { fetchMetadataAndOtherTabularDatasets } from "../../../utils/api-helpers";
import { useContextBuilderState } from "../state/ContextBuilderState";

const warningShownForType = new Set<string>();

export default function useTabularDatasets() {
  const api = useDataExplorerApi();
  const { dimension_type } = useContextBuilderState();

  const [metadataDataset, setMetadataDataset] = useState<TabularDataset>();
  const [metadataIdColumn, setMetadataIdColumn] = useState<string | undefined>(
    undefined
  );
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
        metadataIdColumn: metaIdCol,
      } = await fetchMetadataAndOtherTabularDatasets(
        api,
        dimension_type,
        acceptedColTypes
      );

      if (
        metaDs &&
        !metaDs.given_id &&
        !warningShownForType.has(dimension_type)
      ) {
        // TODO: Maybe we can use taiga_id as proxy for given_id to handle this
        // more gracefully.
        window.console.warn(
          `Warning: metadata dataset for dimension type "${dimension_type}"`,
          "has no given_id! Contexts will be stored using the regular id.",
          "That means they will break when a new version of the metadata is",
          "uploaded :("
        );

        warningShownForType.add(dimension_type);
      }

      setMetadataDataset(metaDs);
      setMetadataIdColumn(metaIdCol);
      setOtherTabularDatasets(others);
      setIsLoadingTabularDatasets(false);
    })();
  }, [api, dimension_type]);

  return {
    metadataDataset,
    metadataIdColumn,
    otherTabularDatasets,
    isLoadingTabularDatasets,
  };
}
