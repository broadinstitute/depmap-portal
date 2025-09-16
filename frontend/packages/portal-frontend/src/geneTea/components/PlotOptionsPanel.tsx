import React, { useRef } from "react";
import ToggleSwitch from "@depmap/common-components/src/components/ToggleSwitch";
import { useGeneTeaContext } from "../context/GeneTeaContext";
import styles from "../styles/GeneTea.scss";

const PlotOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);

  const {
    doClusterTerms,
    handleSetDoClusterTerms,
    doClusterGenes,
    handleSetDoClusterGenes,
    doGroupTerms,
    handleSetDoGroupTerms,
  } = useGeneTeaContext();

  return (
    <div ref={ref} style={{ backgroundColor: "#ffffff" }}>
      <p style={{ fontWeight: 600, marginBottom: 18 }}>
        Use toggles to group and cluster.
      </p>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ alignItems: "center", height: 32, marginBottom: 20 }}>
          <span>Use term clustering.</span>
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
          <span>Use gene clustering.</span>
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
          <span>Group terms when possible.</span>
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
