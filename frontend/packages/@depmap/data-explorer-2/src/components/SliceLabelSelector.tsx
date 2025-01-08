import React, { useEffect, useState } from "react";
import PlotConfigSelect from "./PlotConfigSelect";
import { useDeprecatedDataExplorerApi } from "../contexts/DeprecatedDataExplorerApiContext";
import { urlLibEncode } from "../utils/misc";

interface Props {
  value: string | null;
  onChange: (nextValue: string | null) => void;
  dataset_id: string;
  sliceTypeLabel: string;
  isClearable: boolean;
  menuPortalTarget: HTMLElement | null;
}

function SliceLabelSelector({
  value,
  onChange,
  dataset_id,
  sliceTypeLabel,
  isClearable,
  menuPortalTarget,
}: Props) {
  const api = useDeprecatedDataExplorerApi();
  const [error, setError] = useState(false);
  const [options, setOptions] = useState<Array<{
    label: string;
    value: string;
  }> | null>(null);

  useEffect(() => {
    (async () => {
      setOptions(null);
      setError(false);

      try {
        const data = await api.fetchDimensionLabelsOfDataset(null, dataset_id);
        const opts = data.labels.map((label) => ({ label, value: label }));
        setOptions(opts);
      } catch (e) {
        window.console.error(e);
        setError(true);
      }
    })();
  }, [api, dataset_id]);

  const isLoading = options === null && !error;
  let placeholder = `Choose ${sliceTypeLabel}…`;

  if (isLoading) {
    placeholder = "Loading...";
  }

  if (error) {
    placeholder = "Error loading data";
  }

  return (
    <PlotConfigSelect
      show
      enable={!error}
      label={null}
      value={value}
      isClearable={isClearable}
      isLoading={isLoading}
      options={options || {}}
      placeholder={placeholder}
      menuPortalTarget={menuPortalTarget || undefined}
      onChange={(label) => {
        if (label) {
          onChange(
            [
              "slice",
              // HACK: Prevent this from becoming double-encoded.
              urlLibEncode(decodeURIComponent(dataset_id)),
              urlLibEncode(label),
              "label",
            ].join("/")
          );
        } else {
          onChange(`slice/${urlLibEncode(dataset_id)}/`);
        }
      }}
    />
  );
}

export default SliceLabelSelector;
