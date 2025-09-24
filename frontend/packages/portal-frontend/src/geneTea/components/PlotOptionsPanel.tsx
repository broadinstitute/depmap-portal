import React, { useRef } from "react";
import ToggleSwitch from "@depmap/common-components/src/components/ToggleSwitch";
import { useGeneTeaContext } from "../context/GeneTeaContext";

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
        <ToggleSwitch
          value={doClusterTerms}
          onChange={handleSetDoClusterTerms}
          options={[
            { label: "", value: false },
            { label: "", value: true },
          ]}
        />
        <span style={{ marginLeft: 12 }}>Use term clustering.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <ToggleSwitch
          value={doClusterGenes}
          onChange={handleSetDoClusterGenes}
          options={[
            { label: "", value: false },
            { label: "", value: true },
          ]}
        />
        <span style={{ marginLeft: 12 }}>Use gene clustering.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <ToggleSwitch
          value={doGroupTerms}
          onChange={handleSetDoGroupTerms}
          options={[
            { label: "", value: false },
            { label: "", value: true },
          ]}
        />
        <span style={{ marginLeft: 12 }}>Group terms when possible.</span>
      </div>
    </div>
  );
};

export default PlotOptionsPanel;
