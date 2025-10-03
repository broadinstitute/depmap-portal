import React, { useRef } from "react";
import ToggleSwitch from "@depmap/common-components/src/components/ToggleSwitch";
import { useGeneTeaFiltersContext } from "../context/GeneTeaFiltersContext";
import styles from "../styles/GeneTea.scss";
import PurpleHelpIcon from "./PurpleHelpIcon";

const PlotOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);

  const {
    doClusterTerms,
    handleSetDoClusterTerms,
    doClusterGenes,
    handleSetDoClusterGenes,
    doGroupTerms,
    handleSetDoGroupTerms,
  } = useGeneTeaFiltersContext();

  return (
    <div ref={ref} style={{ backgroundColor: "#ffffff" }}>
      <p style={{ fontWeight: 600, marginBottom: 18 }}>
        Use toggles to group and cluster.
      </p>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ alignItems: "center", height: 32, marginBottom: 20 }}>
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
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ alignItems: "center", height: 32, marginBottom: 20 }}>
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
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ alignItems: "center", height: 32, marginBottom: 20 }}>
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
    </div>
  );
};

export default PlotOptionsPanel;
