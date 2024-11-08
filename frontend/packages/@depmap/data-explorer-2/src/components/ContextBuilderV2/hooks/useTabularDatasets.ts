import { useContext, useEffect, useState } from "react";
import { ApiContext } from "@depmap/api";
import { TabularDataset } from "@depmap/types";
import { useContextBuilderState } from "../state/ContextBuilderState";

export default function useTabularDatasets() {
  const { getApi } = useContext(ApiContext);
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
      const [types, datasets] = await Promise.all([
        getApi().getDimensionTypes(),
        getApi().getBreadboxDatasets(),
      ]);

      const dimType = types.find((t) => t.name === dimension_type);

      const allTabularDatasets = datasets.filter(
        (d) =>
          d.format === "tabular_dataset" && d.index_type_name === dimension_type
      ) as TabularDataset[];

      const metaDs = allTabularDatasets.find((d) => {
        return (
          dimType?.metadata_dataset_id && d.id === dimType.metadata_dataset_id
        );
      });

      const others = allTabularDatasets
        .filter((d) => {
          return (
            !dimType ||
            !dimType.metadata_dataset_id ||
            d.id !== dimType.metadata_dataset_id
          );
        })
        .filter((d) => {
          return Object.values(d.columns_metadata).some((metadata) => {
            // TODO: Add support for type "list_strings"
            return (
              metadata.col_type === "text" ||
              metadata.col_type === "categorical"
            );
          });
        });

      setMetadataDataset(metaDs);
      setOtherTabularDatasets(others);
      setIsLoadingTabularDatasets(false);
    })();
  }, [dimension_type, getApi]);

  return {
    metadataDataset,
    otherTabularDatasets,
    isLoadingTabularDatasets,
  };
}
