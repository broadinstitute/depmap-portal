import React, { useEffect, useState } from "react";
import {
  fetchDimensionLabels,
  fetchDimensionLabelsOfDataset,
} from "../../../../api";
import CompoundSearcher from "./CompoundSearcher";
import { extractCompoundNames, fetchCompoundDatasets } from "./utils";

interface Props {
  value: string | null;
  onChangeCompoundName: (name: string | null) => void;
  onChange: (slice_label: string, dataset_id: string) => void;
  swatchColor?: string;
  isColorSelector: boolean;
  dataset_id: string | null;
}

function CompoundNameSelect({
  value,
  onChangeCompoundName,
  onChange,
  swatchColor = undefined,
  isColorSelector,
  dataset_id,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    []
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const { labels } = await (isColorSelector && dataset_id
          ? fetchDimensionLabelsOfDataset("compound_experiment", dataset_id)
          : fetchDimensionLabels("compound_experiment"));

        const nextOptions = extractCompoundNames(labels).map((name) => ({
          label: name,
          value: name,
        }));

        setOptions(nextOptions);
      } catch (e) {
        window.console.error(e);
      }

      setIsLoading(false);
    })();
  }, [dataset_id, isColorSelector]);

  const handleChange = async (nextValue: string | null) => {
    if (nextValue === null) {
      onChangeCompoundName(null);
      return;
    }

    setIsLoading(true);

    const allDatasets = await fetchCompoundDatasets(nextValue);

    const datasets = isColorSelector
      ? allDatasets.filter((d) => d.dataset_id === dataset_id)
      : allDatasets;

    setIsLoading(false);

    // TODO: Handle the case where `isColorSelector` is true and there is no
    // dataset_id selected yet!
    if (datasets.length === 1 && datasets[0].dimension_labels.length === 1) {
      onChange(datasets[0].dimension_labels[0], datasets[0].dataset_id);
    } else {
      onChangeCompoundName(nextValue);
    }
  };

  return (
    <CompoundSearcher
      value={value}
      onChange={handleChange}
      isLoading={isLoading}
      compoundNames={options.map(({ label }) => label)}
      swatchColor={swatchColor}
    />
  );
}

export default CompoundNameSelect;
