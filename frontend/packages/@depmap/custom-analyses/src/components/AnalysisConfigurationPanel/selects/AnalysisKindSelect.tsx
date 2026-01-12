import React from "react";
import { AnalysisConfiguration } from "../../../types/AnalysisConfiguration";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  value?: AnalysisConfiguration["kind"];
  onChange: (nextKind: AnalysisConfiguration["kind"]) => void;
}

function AnalysisKindSelect({ value = undefined, onChange }: Props) {
  return (
    <div className={styles.AnalysisKindSelect}>
      <label>
        <input
          type="radio"
          name="kind"
          value="pearson_correlation"
          checked={value === "pearson_correlation"}
          onChange={() => onChange("pearson_correlation")}
        />
        <strong>Pearson correlation</strong>
        <p>
          Computes Pearson correlation for each feature in the selected dataset
          along with corresponding q-value.
        </p>
      </label>
      <label>
        <input
          type="radio"
          name="kind"
          value="two_class_comparison"
          checked={value === "two_class_comparison"}
          onChange={() => onChange("two_class_comparison")}
        />
        <strong>Two class comparison</strong>
        <p>
          Computes a moderated estimate of the difference between groups’ means
          for each feature along with the corresponding q-value.
        </p>
      </label>
    </div>
  );
}

export default AnalysisKindSelect;
