import React, { useEffect, useState } from "react";
import { AnnotationType, SliceQuery, TabularDataset } from "@depmap/types";
import { useDataExplorerApi } from "../../../../contexts/DataExplorerApiContext";
import renderConditionally from "../../../../utils/render-conditionally";
import { fetchMetadataAndOtherTabularDatasets } from "../../../../utils/api-helpers";
import PlotConfigSelect from "../../../PlotConfigSelect";

interface Props {
  slice_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
}

function MetadataColumnSelect({ slice_type, value, onChange }: Props) {
  const api = useDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);

  const [metadataDataset, setMetadataDataset] = useState<
    TabularDataset | undefined
  >();

  useEffect(() => {
    (async () => {
      const acceptedColTypes = ["categorical" as AnnotationType];

      setIsLoading(true);

      const {
        metadataDataset: mdd,
      } = await fetchMetadataAndOtherTabularDatasets(
        api,
        slice_type,
        acceptedColTypes
      );

      setMetadataDataset(mdd);
      setIsLoading(false);

      if (!mdd) {
        window.console.warn(
          `No metadata for index_type "${slice_type}"`,
          `and col_type(s) "${acceptedColTypes}" found!`
        );
      }
    })();
  }, [api, slice_type]);

  const options = Object.keys(metadataDataset?.columns_metadata || {}).map(
    (key) => ({
      label: key,
      value: key,
    })
  );

  return (
    <PlotConfigSelect
      show
      isClearable
      enable={!isLoading}
      isLoading={isLoading}
      placeholder="Choose annotation…"
      value={value?.identifier || null}
      options={options}
      onChange={(identifier) => {
        onChange(
          identifier && metadataDataset
            ? {
                dataset_id: metadataDataset.id,
                identifier_type: "column",
                identifier,
              }
            : null
        );
      }}
    />
  );
}

export default renderConditionally(MetadataColumnSelect);
