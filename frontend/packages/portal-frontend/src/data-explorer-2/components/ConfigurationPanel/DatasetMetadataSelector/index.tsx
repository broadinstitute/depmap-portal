import React from "react";
import { PlotConfigSelect, SliceLabelSelector } from "@depmap/data-explorer-2";
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
  const options = getOptions(entity_type);
  const hasDynamicLabel = containsPartialSlice(value, entity_type);

  const value1 = hasDynamicLabel
    ? slicePrefix(value as string, entity_type)
    : value;
  const value2 = hasDynamicLabel ? sliceLabel(value as string) : null;

  if (typeof value1 === "string" && !(value1 in options)) {
    options[value1] = "(unknown property)";
  }

  return (
    <div className={styles.colorBySelector}>
      <PlotConfigSelect
        label={null}
        isClearable
        placeholder="Choose property…"
        show={show}
        enable={enable}
        value={value1}
        options={options}
        onChange={onChange}
      />
      {hasDynamicLabel && (
        <SliceLabelSelector
          value={value2}
          onChange={onChange}
          isClearable={false}
          menuPortalTarget={null}
          dataset_id={getDatasetIdFromSlice(value as string, entity_type)}
          entityTypeLabel={getMetadataEntityTypeLabelFromSlice(
            value as string,
            entity_type
          )}
        />
      )}
    </div>
  );
}

export default DatasetMetadataSelector;
