import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import { MatrixDataset } from "@depmap/types";
import { dataTypeSortComparator } from "@depmap/utils";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  index_type: string;
  value: string | null;
  onChange: (nextValue: string) => void;
}

type Options = { label: string; value: string }[];
type GroupedOptions = { label: string; options: Options }[];

const computeOptions = async (index_type: string) => {
  const datasets = await cached(breadboxAPI).getDatasets();
  const priorities: Record<string, number> = {};
  for (const d of datasets) {
    priorities[d.id] = d.priority ?? -Infinity;
  }

  const dimTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimTypes.find((t) => t.name === index_type);
  const axis = dimType?.axis || "features";

  const options = datasets
    .filter(
      (d) => d.format === "matrix_dataset" && d.value_type === "continuous"
    )
    .filter((d) =>
      axis === "sample"
        ? (d as MatrixDataset).sample_type_name === index_type
        : (d as MatrixDataset).feature_type_name === index_type
    )
    .sort((a, b) => priorities[a.id] - priorities[b.id])
    .map((d) => ({
      label: d.name,
      value: d.given_id || d.id,
    }));

  const groups: Record<string, Options> = {};

  options.forEach((option) => {
    const dataset = datasets.find(
      (d) => d.id === option.value || d.given_id === option.value
    )!;

    if (dataset) {
      groups[dataset.data_type] ||= [];
      groups[dataset.data_type].push(option);
    }
  });

  return Object.keys(groups)
    .map((dataType) => {
      const optsForDataType = groups[dataType].sort(
        (a, b) => priorities[a.value] - priorities[b.value]
      );

      return { label: dataType, options: optsForDataType };
    })
    .sort((a, b) => dataTypeSortComparator(a.label, b.label));
};

function AnalysisDataVersionSelect({ index_type, value, onChange }: Props) {
  const [options, setOptions] = useState<GroupedOptions>([]);

  useEffect(() => {
    computeOptions(index_type).then(setOptions);
  }, [index_type]);

  return (
    <div className={styles.AnalysisDimensionSelectContainer}>
      <PlotConfigSelect
        className={styles.AnalysisDimensionSelect}
        placeholder="Select data version…"
        show
        enable
        value={value}
        onChange={(nextValue) => onChange(nextValue as string)}
        options={options}
        isLoading={options.length === 0}
      />
    </div>
  );
}

export default AnalysisDataVersionSelect;
