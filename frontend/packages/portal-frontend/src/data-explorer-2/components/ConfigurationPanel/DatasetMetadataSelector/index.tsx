import React, { useEffect, useState } from "react";
import {
  fetchMetadataSlices,
  MetadataSlices,
  PlotConfigSelect,
  SliceLabelSelector,
} from "@depmap/data-explorer-2";
import {
  containsPartialSlice,
  getDatasetIdFromSlice,
  getMetadataEntityTypeLabelFromSlice,
  getOptions,
  sliceLabel,
  slicePrefix,
} from "src/data-explorer-2/components/ConfigurationPanel/DatasetMetadataSelector/utils";
import styles from "src/data-explorer-2/styles/ConfigurationPanel.scss";

interface Props {
  show: boolean;
  enable: boolean;
  entity_type: string;
  value: string | null;
  onChange: (nextValue: string | null) => void;
}

function DatasetMetadataSelector({
  show,
  enable,
  entity_type,
  value,
  onChange,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [metadataSlices, setMetadataSlices] = useState<MetadataSlices>({});

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      const slices = await fetchMetadataSlices(entity_type);
      setMetadataSlices(slices);

      setIsLoading(false);
    })();
  }, [entity_type]);

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
    <div className={styles.colorBySelector}>
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
          entityTypeLabel={getMetadataEntityTypeLabelFromSlice(
            metadataSlices,
            value as string
          )}
        />
      )}
    </div>
  );
}

export default DatasetMetadataSelector;
