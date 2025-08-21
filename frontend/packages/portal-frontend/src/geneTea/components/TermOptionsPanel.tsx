import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "../styles/MultiSelectTextArea.scss";
import { Button } from "react-bootstrap";

import NumberInput from "./NumberInput";
import { SectionStackContext } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/SectionStack";
import { useGeneTeaContext } from "../context/GeneTeaContext";
import { SortOption } from "../types";

const DEFAULTS = {
  sortBy: "Effect Size",
  maxTopTerms: 10,
  maxFDR: 0.05,
  effectSizeThreshold: 0.1,
  minMatchingQuery: 2,
  maxMatchingOverall: 5373,
};

const TermOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);
  const [hasScrollBar, setHasScrollBar] = useState(false);
  const { sectionHeights } = useContext(SectionStackContext);
  const {
    sortBy,
    handleSetSortBy,
    maxTopTerms,
    handleSetMaxTopTerms,
    maxFDR,
    handleSetMaxFDR,
    effectSizeThreshold,
    handleSetEffectSizeThreshold,
    minMatchingQuery,
    handleSetMinMatchingQuery,
    maxMatchingOverall,
    handleSetMaxMatchingOverall,
  } = useGeneTeaContext();

  // Local state for staged changes
  const [localSortBy, setLocalSortBy] = useState<string>(sortBy);
  const [localMaxTopTerms, setLocalMaxTopTerms] = useState<number>(
    maxTopTerms ?? DEFAULTS.maxTopTerms
  );
  const [localMaxFDR, setLocalMaxFDR] = useState<number>(maxFDR);
  const [
    localEffectSizeThreshold,
    setLocalEffectSizeThreshold,
  ] = useState<number>(effectSizeThreshold);
  const [localMinMatchingQuery, setLocalMinMatchingQuery] = useState<number>(
    minMatchingQuery
  );
  const [
    localMaxMatchingOverall,
    setLocalMaxMatchingOverall,
  ] = useState<number>(maxMatchingOverall || DEFAULTS.maxMatchingOverall);

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
      <p style={{ fontWeight: 600, marginBottom: 12 }}>
        Sort order for selecting top terms
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="sortBy"
            value="Effect Size"
            checked={localSortBy === "Effect Size"}
            onChange={() => setLocalSortBy("Effect Size")}
          />
          Effect Size &gt; FDR
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="sortBy"
            value="Significance"
            checked={localSortBy === "Significance"}
            onChange={() => setLocalSortBy("Significance")}
          />
          FDR &gt; Effect Size
        </label>
        <NumberInput
          name="maxTopTerms"
          label="Max. Top Terms"
          min={3}
          step={1}
          value={localMaxTopTerms}
          setValue={setLocalMaxTopTerms}
          defaultValue={DEFAULTS.maxTopTerms}
        />
        <NumberInput
          name="maxFDR"
          label="FDR Threshold"
          min={0}
          value={localMaxFDR}
          setValue={setLocalMaxFDR}
          defaultValue={DEFAULTS.maxFDR}
          step={0.01}
        />
        <NumberInput
          name="effectSizeThreshold"
          label="Effect Size Threshold"
          min={0}
          value={localEffectSizeThreshold}
          setValue={setLocalEffectSizeThreshold}
          defaultValue={DEFAULTS.effectSizeThreshold}
          step={0.01}
        />
        <NumberInput
          name="minMatchingQuery"
          label="Min. Matching Query"
          min={0}
          value={localMinMatchingQuery}
          setValue={setLocalMinMatchingQuery}
          defaultValue={DEFAULTS.minMatchingQuery}
          step={1}
        />
        <NumberInput
          name="maxMatchingOverall"
          label="Max. Matching Overall"
          min={0}
          value={localMaxMatchingOverall}
          setValue={setLocalMaxMatchingOverall}
          defaultValue={DEFAULTS.maxMatchingOverall}
          step={1}
        />
        <div
          className={styles.buttonRow}
          style={{
            marginTop: 8,
            paddingTop: 0,
            paddingBottom: 0,
            background: "none",
          }}
        >
          <Button
            className={styles.selectGenesButton}
            onClick={() => {
              handleSetSortBy(localSortBy as any);
              handleSetMaxTopTerms(localMaxTopTerms);
              handleSetMaxFDR(localMaxFDR);
              handleSetMaxMatchingOverall(localMaxMatchingOverall);
              handleSetMinMatchingQuery(localMinMatchingQuery);
              handleSetEffectSizeThreshold(localEffectSizeThreshold);
            }}
            style={{ marginBottom: 0 }}
          >
            Apply
          </Button>
          <Button
            className={styles.clearInputButton}
            onClick={() => {
              setLocalSortBy(DEFAULTS.sortBy);
              setLocalMaxTopTerms(DEFAULTS.maxTopTerms);
              setLocalMaxMatchingOverall(DEFAULTS.maxMatchingOverall);
              setLocalMinMatchingQuery(DEFAULTS.minMatchingQuery);
              setLocalEffectSizeThreshold(DEFAULTS.effectSizeThreshold);
              handleSetSortBy(DEFAULTS.sortBy as SortOption);
              handleSetMaxTopTerms(DEFAULTS.maxTopTerms);
              handleSetMaxFDR(DEFAULTS.maxFDR);
              handleSetMaxMatchingOverall(DEFAULTS.maxMatchingOverall);
              handleSetMinMatchingQuery(DEFAULTS.minMatchingQuery);
              handleSetEffectSizeThreshold(DEFAULTS.effectSizeThreshold);
            }}
            style={{ marginBottom: 0 }}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermOptionsPanel;
