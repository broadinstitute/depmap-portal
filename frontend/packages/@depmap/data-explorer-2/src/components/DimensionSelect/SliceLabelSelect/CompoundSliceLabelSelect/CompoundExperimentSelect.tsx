import React, { useEffect, useMemo, useState } from "react";
import { WordBreaker } from "@depmap/common-components";
import renderConditionally from "../../../../utils/render-conditionally";
import { useDeprecatedDataExplorerApi } from "../../../../contexts/DeprecatedDataExplorerApiContext";
import PlotConfigSelect from "../../../PlotConfigSelect";
import { extractExperiment, fetchCompoundDatasets } from "./utils";
import styles from "../../../../styles/DimensionSelect.scss";

interface Props {
  compoundName: string | null;
  slice_label: string | null;
  dataset_id: string | null;
  onChange: (slice_label: string | null, dataset_id: string | null) => void;
  isColorSelector: boolean;
}

function CompoundExperimentSelect({
  compoundName,
  slice_label,
  dataset_id,
  onChange,
  isColorSelector,
}: Props) {
  const api = useDeprecatedDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [datasetsWithEntities, setDatasetsWithEntities] = useState<
    | {
        dataset_id: string;
        dataset_label: string;
        dimension_labels: string[];
      }[]
    | null
  >(null);

  useEffect(() => {
    if (!compoundName) {
      setIsLoading(false);
      setDatasetsWithEntities(null);
      return;
    }

    (async () => {
      setIsLoading(true);

      try {
        const allDatasets = await fetchCompoundDatasets(api, compoundName);

        const datasets =
          isColorSelector && dataset_id
            ? allDatasets.filter((d) => d.dataset_id === dataset_id)
            : allDatasets;

        setDatasetsWithEntities(datasets);
      } catch (e) {
        window.console.error(e);
      }

      setIsLoading(false);
    })();
  }, [api, compoundName, isColorSelector, dataset_id]);

  const options = useMemo(() => {
    const out: {
      label: string | null;
      value: string; // HACK: encoded as JSON
    }[] = [];

    (datasetsWithEntities || []).forEach((d) => {
      d.dimension_labels.forEach((label) => {
        out.push({
          label: extractExperiment(label),
          value: JSON.stringify({
            slice_label: label,
            dataset_id: d.dataset_id,
          }),
        });
      });
    });

    return out;
  }, [datasetsWithEntities]);

  const displayValue =
    slice_label && dataset_id
      ? JSON.stringify({ slice_label, dataset_id })
      : null;

  const handleChange = (nextValue: string | null) => {
    if (nextValue === null) {
      onChange(null, null);
    } else {
      const parsed = JSON.parse(nextValue);
      onChange(parsed.slice_label, parsed.dataset_id);
    }
  };

  const formatOptionLabel = (
    { value, label }: { value: string; label: string },
    { context }: { context: "menu" | "value" }
  ) => {
    if (context === "value") {
      return label;
    }

    const dataset = JSON.parse(value);
    const dataset_label = datasetsWithEntities!.find(
      (d) => d.dataset_id === dataset.dataset_id
    )!.dataset_label;

    return (
      <div>
        {label} <br />
        <b>{dataset_label}</b>
      </div>
    );
  };

  const dataset_label =
    displayValue && dataset_id && datasetsWithEntities
      ? datasetsWithEntities.find((d) => d.dataset_id === dataset_id)
          ?.dataset_label
      : null;

  return (
    <div>
      <PlotConfigSelect
        show
        enable
        label={null}
        value={displayValue}
        options={options}
        isLoading={isLoading}
        onChange={handleChange}
        placeholder="Choose an experiment…"
        formatOptionLabel={formatOptionLabel}
      />
      {dataset_label && (
        <div className={styles.selectedDatasetLabel}>
          <WordBreaker text={dataset_label} />
        </div>
      )}
    </div>
  );
}

export default renderConditionally(CompoundExperimentSelect);
