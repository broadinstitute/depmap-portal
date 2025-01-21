import React, { useEffect, useMemo, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import { useDeprecatedDataExplorerApi } from "../../../contexts/DeprecatedDataExplorerApiContext";
import PlotConfigSelect from "../../PlotConfigSelect";
import { toOutputValue } from "./utils";

interface Props {
  slice_type: string;
  dataset_id: string | null;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  swatchColor?: string;
}

// HACK: This is a simplified version of SliceLabelSelect intended to be used
// with custom data (e.g. the transient datasets used by Custom Analysis). It
// uses `fetchDimensionLabelsOfDataset()` because custom feature labels aren't
// discoverable using `fetchDimensionLabelsToDatasetsMapping()`.
function CustomSliceLabelSelect({
  slice_type,
  dataset_id,
  value,
  onChange,
  swatchColor = undefined,
}: Props) {
  const api = useDeprecatedDataExplorerApi();
  const [dsError, setDsError] = useState(false);
  const [sliceLabels, setSliceLabels] = useState<string[] | null>(null);

  useEffect(() => {
    setSliceLabels(null);
    setDsError(false);

    (async () => {
      if (slice_type && dataset_id) {
        try {
          const data = await api.fetchDimensionLabelsOfDataset(
            slice_type,
            dataset_id
          );
          setSliceLabels(data.labels);
        } catch (e) {
          setDsError(true);
          window.console.error(e);
        }
      }
    })();
  }, [api, slice_type, dataset_id]);

  const options = useMemo(() => {
    return (sliceLabels || []).map((label) => ({ label, value: label }));
  }, [sliceLabels]);

  const notFound = useMemo(() => {
    if (!sliceLabels || !value) {
      return false;
    }

    return !sliceLabels.find((label) => label === value.name);
  }, [sliceLabels, value]);

  let placeholder = "Choose a custom value…";

  if (dsError) {
    placeholder = "Unknown dataset";
  }

  if (notFound) {
    placeholder = `“${value?.name}” not found`;
  }

  return (
    <PlotConfigSelect
      show
      enable
      isClearable
      label={null}
      width={300}
      value={value && !dsError && !notFound ? value.name : null}
      options={options}
      placeholder={placeholder}
      hasError={dsError || notFound}
      isLoading={sliceLabels === null && !dsError}
      swatchColor={swatchColor}
      onChangeUsesWrappedValue
      onChange={(option) => onChange(toOutputValue(slice_type, option as any))}
    />
  );
}

export default CustomSliceLabelSelect;
