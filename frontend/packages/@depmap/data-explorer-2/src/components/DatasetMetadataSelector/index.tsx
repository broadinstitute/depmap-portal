import React, { useEffect, useState } from "react";
import {
  DeprecatedDataExplorerApiResponse,
  useDeprecatedDataExplorerApi,
} from "../../contexts/DeprecatedDataExplorerApiContext";
import PlotConfigSelect from "../PlotConfigSelect";
import SliceLabelSelector from "../SliceLabelSelector";
import {
  containsPartialSlice,
  getDatasetIdFromSlice,
  getMetadataSliceTypeLabelFromSlice,
  getOptions,
  sliceLabel,
  slicePrefix,
} from "./utils";

interface Props {
  show: boolean;
  enable: boolean;
  slice_type: string;
  value: string | null;
  onChange: (nextValue: string | null) => void;
}

function DatasetMetadataSelector({
  show,
  enable,
  slice_type,
  value,
  onChange,
}: Props) {
  const api = useDeprecatedDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [metadataSlices, setMetadataSlices] = useState<
    DeprecatedDataExplorerApiResponse["fetchMetadataSlices"]
  >({});

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      const slices = await api.fetchMetadataSlices(slice_type);
      setMetadataSlices(slices);

      setIsLoading(false);
    })();
  }, [api, slice_type]);

  const hasDynamicLabel = containsPartialSlice(metadataSlices, value);

  const value1 = hasDynamicLabel
    ? slicePrefix(metadataSlices, value as string)
    : value;
  const value2 = hasDynamicLabel ? sliceLabel(value as string) : null;

  const options = getOptions(metadataSlices);

  if (typeof value1 === "string" && !(value1 in options)) {
    options[value1] = isLoading ? "Loading…" : "(unknown property)";
  }

  return (
    <div>
      <PlotConfigSelect
        label={null}
        isClearable
        placeholder="Choose property…"
        show={show}
        enable={enable && !isLoading}
        value={value1}
        options={options}
        onChange={onChange}
        isLoading={isLoading}
      />
      {hasDynamicLabel && (
        <SliceLabelSelector
          value={value2}
          onChange={onChange}
          isClearable={false}
          menuPortalTarget={null}
          dataset_id={getDatasetIdFromSlice(metadataSlices, value as string)}
          sliceTypeLabel={getMetadataSliceTypeLabelFromSlice(
            metadataSlices,
            value as string
          )}
        />
      )}
    </div>
  );
}

export default DatasetMetadataSelector;
