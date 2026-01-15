import React, { useRef, useState, useMemo, useCallback } from "react";
import ToggleSwitch from "@depmap/common-components/src/components/ToggleSwitch";
import {
  useGeneTeaFiltersContext,
  NUMERIC_FILTER_DEFAULTS,
} from "../context/GeneTeaFiltersContext";
import styles from "../styles/GeneTea.scss";
import PurpleHelpIcon from "./PurpleHelpIcon";
import NumberInput from "./NumberInput";
import debounce from "lodash.debounce";

const PlotOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);

  const {
    maxTopTerms,
    handleSetMaxTopTerms,
    doClusterTerms,
    handleSetDoClusterTerms,
    doClusterGenes,
    handleSetDoClusterGenes,
    doGroupTerms,
    handleSetDoGroupTerms,
  } = useGeneTeaFiltersContext();

  const [localMaxTopTerms, setLocalMaxTopTerms] = useState<number>(
    maxTopTerms ?? NUMERIC_FILTER_DEFAULTS.maxTopTerms
  );

  const debouncedSetMaxTerms = useMemo(
    () => debounce((maxTerms_) => handleSetMaxTopTerms(maxTerms_), 800),
    [handleSetMaxTopTerms]
  );

  const updateMaxTerms = useCallback(
    (numTerms: number) => {
      setLocalMaxTopTerms(numTerms);
      debouncedSetMaxTerms(numTerms);
    },
    [debouncedSetMaxTerms]
  );

  return (
    <div ref={ref} className={styles.PlotOptionsPanel}>
      <p className={styles.sectionLabel}>Use toggles to group and cluster.</p>
      <div className={styles.sectionItemWrapper}>
        <div className={styles.sectionItem}>
          <span>
            Use term clustering.{" "}
            <span>
              <PurpleHelpIcon
                tooltipText="Apply hierarchical clustering to the term axis, such that terms with similar gene embeddings appear together.  Deselecting this will order the terms by their ranking in the enrichment, see Term Options to change the sort order."
                popoverId="use-term-clustering-help"
              />
            </span>
          </span>
          <ToggleSwitch
            className={styles.toggleSwitch}
            value={doClusterTerms}
            onChange={handleSetDoClusterTerms}
            options={[
              { label: "OFF", value: false },
              { label: "ON", value: true },
            ]}
          />
        </div>
      </div>
      <div className={styles.sectionItemWrapper}>
        <div className={styles.sectionItem}>
          <span>
            Use gene clustering.{" "}
            <span>
              <PurpleHelpIcon
                tooltipText="Apply hierarchical clustering to the gene axis, such that genes with similar term embeddings appear together.  Deselecting this will order the genes by position in the input list (alphabetical for contexts)."
                popoverId="use-gene-clustering-help"
              />
            </span>
          </span>
          <ToggleSwitch
            className={styles.toggleSwitch}
            value={doClusterGenes}
            onChange={handleSetDoClusterGenes}
            options={[
              { label: "OFF", value: false },
              { label: "ON", value: true },
            ]}
          />
        </div>
      </div>
      <div className={styles.sectionItemWrapper}>
        <div className={styles.sectionItem}>
          <span>
            Group terms when possible.{" "}
            <span>
              <PurpleHelpIcon
                tooltipText="Uses the Term Group column to define the y-axis, where the heatmap is colored by the fraction of terms in the group that appear in a given gene’s description. In an effort to reduce redundancy, GeneTEA dynamically groups enriched terms based on the tf-idf embedding similarity for the query, labeling the group with the most informative sub-terms.  Deselecting this will use the Term column to define the y-axis, such that the heatmap is a binary indicator of the prescence/absence of a term in a given gene’s description."
                popoverId="group-terms-help"
              />
            </span>
          </span>
          <ToggleSwitch
            className={styles.toggleSwitch}
            value={doGroupTerms}
            onChange={handleSetDoGroupTerms}
            options={[
              { label: "OFF", value: false },
              { label: "ON", value: true },
            ]}
          />
        </div>
      </div>
      <hr className={styles.hrSectionDivider} />
      <p className={styles.sectionLabel}>
        Choose the number of terms or term groups to plot.
      </p>
      <div className={styles.sectionItemWrapper}>
        <NumberInput
          width={"50%"}
          name="maxTopTerms"
          label="Max. n Terms/Term Groups"
          purpleHelpIcon={
            <PurpleHelpIcon
              tooltipText="Limits the maximum number of terms or term groups in the y-axis of the plot."
              popoverId="maxTopTerms-help"
            />
          }
          min={1}
          max={25}
          step={1}
          value={localMaxTopTerms}
          setValue={updateMaxTerms}
          defaultValue={NUMERIC_FILTER_DEFAULTS.maxTopTerms}
        />
      </div>
    </div>
  );
};

export default PlotOptionsPanel;
