import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  value: string | null;
  onChange: any;
}

function TranscriptDatasetSelect({ value, onChange }: Props) {
  const [options, setOptions] = useState<Record<string, string> | null>(null);
  const isLoading = options === null;

  useEffect(() => {
    cached(breadboxAPI)
      .getDatasets()
      .then((datasets) => {
        const nextOpts: Record<string, string> = {};

        datasets
          .filter((d) => {
            return (
              d.format === "matrix_dataset" &&
              d.feature_type_name === "transcript"
            );
          })
          .forEach((d) => {
            nextOpts[d.given_id || d.id] = d.name;
          });

        setOptions(nextOpts);
      });
  }, []);

  return (
    <div className={styles.TranscriptDatasetSelect}>
      <PlotConfigSelect
        show
        // isClearable
        value={value}
        data-version-select
        options={options || {}}
        onChange={onChange}
        enable={!isLoading}
        label="Data Version"
        isLoading={isLoading}
        placeholder={isLoading ? "Loading…" : "Select data version…"}
      />
    </div>
  );
}

export default TranscriptDatasetSelect;
