import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { PlotConfigSelect } from "@depmap/data-explorer-2";
import HelpTip from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/HelpTip";
import styles from "../../../styles/TranscriptPlotConfig.scss";

interface Props {
  value: string | null;
  onChange: (nextValue: string | null) => void;
}

function GeneSelect({ value, onChange }: Props) {
  const [options, setOptions] = useState<any[]>([]);

  useEffect(() => {
    cached(breadboxAPI)
      .getTabularDatasetData("transcript_metadata", {
        columns: ["Gene"],
      })
      .then((result) => {
        const indexedValues = (result as any).Gene;
        const uniqueVals = new Set(Object.values(indexedValues));
        const sorted = [...uniqueVals].sort();
        const opts = sorted.map((label) => ({ label, value: label }));
        setOptions(opts);
      });
  }, []);

  return (
    <PlotConfigSelect
      show
      className={styles.geneSelect}
      enable={options.length > 0}
      label={
        <span>
          See Transcripts for Gene
          <HelpTip id="temp-transcripts-by-gene" />
        </span>
      }
      placeholder="Choose a gene…"
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
export default GeneSelect;
