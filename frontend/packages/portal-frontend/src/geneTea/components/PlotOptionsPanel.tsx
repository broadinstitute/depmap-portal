import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import ToggleSwitch from "@depmap/common-components/src/components/ToggleSwitch";
import { SectionStackContext } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/SectionStack";
import { useGeneTeaContext } from "../context/GeneTeaContext";

const PlotOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);
  const [hasScrollBar, setHasScrollBar] = useState(false);
  const { sectionHeights } = useContext(SectionStackContext);

  const {
    doClusterTerms,
    handleSetDoClusterTerms,
    doClusterGenes,
    handleSetDoClusterGenes,
    doGroupTerms,
    handleSetDoGroupTerms,
  } = useGeneTeaContext();

  const checkScrollBar = useCallback(() => {
    if (ref.current) {
      const stack = ref.current.closest("#section-stack") as Element;
      setHasScrollBar(stack.scrollHeight > stack.clientHeight);
    }
  }, []);

  useEffect(checkScrollBar, [checkScrollBar, sectionHeights]);

  useEffect(() => {
    window.addEventListener("resize", checkScrollBar);
    return () => window.removeEventListener("resize", checkScrollBar);
  }, [checkScrollBar]);

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
