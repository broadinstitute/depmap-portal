import React, { useEffect, useState } from "react";
import { AnnotationType, SliceQuery, TabularDataset } from "@depmap/types";
import renderConditionally from "../../../../utils/render-conditionally";
import { fetchMetadataAndOtherTabularDatasets } from "../../../../utils/api-helpers";
import PlotConfigSelect from "../../../PlotConfigSelect";

interface Props {
  slice_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
}

function MetadataColumnSelect({ slice_type, value, onChange }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const [metadataDataset, setMetadataDataset] = useState<
    TabularDataset | undefined
  >();

  useEffect(() => {
    (async () => {
      const acceptedColTypes = [
        "categorical" as AnnotationType,
        // TODO: In the future we should only support "categorical" and
        // remove "text" here. But most datasets are not tagged that way
        // which can make it appear we are missing metadata. For now, we'lll
        // include "text" even though that may include some columns that have
        // too many disinct values to color by.
        "text" as AnnotationType,
      ];

      setIsLoading(true);

      const {
        metadataDataset: mdd,
      } = await fetchMetadataAndOtherTabularDatasets(
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
  }, [slice_type]);

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
