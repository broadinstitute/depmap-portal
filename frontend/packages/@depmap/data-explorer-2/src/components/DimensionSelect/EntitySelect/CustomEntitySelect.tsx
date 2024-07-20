import React, { useEffect, useMemo, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import { fetchEntityLabelsOfDataset } from "../../../api";
import PlotConfigSelect from "../../PlotConfigSelect";
import { toOutputValue } from "./utils";

interface Props {
  entity_type: string;
  dataset_id: string | null;
  value: DataExplorerContext | null;
  onChange: (context: DataExplorerContext | null) => void;
  swatchColor?: string;
}

// HACK: This is a simplified version of EntitySelect intended to be used with
// custom data (e.g. the transient datasets used by Custom Analysis). It uses
// `fetchEntityLabelsOfDataset()` because feature labels aren't discoverable
// using `fetchEntityToDatasetsMapping()`.
function CustomEntitySelect({
  entity_type,
  dataset_id,
  value,
  onChange,
  swatchColor = undefined,
}: Props) {
  const [dsError, setDsError] = useState(false);
  const [entityLabels, setEntityLabels] = useState<string[] | null>(null);

  useEffect(() => {
    setEntityLabels(null);
    setDsError(false);

    (async () => {
      if (entity_type && dataset_id) {
        try {
          const data = await fetchEntityLabelsOfDataset(
            entity_type,
            dataset_id
          );
          setEntityLabels(data.labels);
        } catch (e) {
          setDsError(true);
          window.console.error(e);
        }
      }
    })();
  }, [entity_type, dataset_id]);

  const options = useMemo(() => {
    return (entityLabels || []).map((label) => ({ label, value: label }));
  }, [entityLabels]);

  const notFound = useMemo(() => {
    if (!entityLabels || !value) {
      return false;
    }

    return !entityLabels.find((label) => label === value.name);
  }, [entityLabels, value]);

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
      isLoading={entityLabels === null && !dsError}
      swatchColor={swatchColor}
      onChangeUsesWrappedValue
      onChange={(option) => onChange(toOutputValue(entity_type, option as any))}
    />
  );
}

export default CustomEntitySelect;
