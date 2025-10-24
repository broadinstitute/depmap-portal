import React, { useRef, useState } from "react";
import styles from "../styles/MultiSelectTextArea.scss";
import { Button } from "react-bootstrap";

import NumberInput from "./NumberInput";
import {
  TERM_OPTIONS_FILTER_DEFAULTS,
  useGeneTeaFiltersContext,
} from "../context/GeneTeaFiltersContext";
import { SortOption } from "../types";
import PurpleHelpIcon from "./PurpleHelpIcon";

const TermOptionsPanel: React.FC = () => {
  const ref = useRef<HTMLTableElement>(null);

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
  } = useGeneTeaFiltersContext();

  // Local state for staged changes
  const [localSortBy, setLocalSortBy] = useState<string>(sortBy);
  const [localMaxTopTerms, setLocalMaxTopTerms] = useState<number>(
    maxTopTerms ?? TERM_OPTIONS_FILTER_DEFAULTS.maxTopTerms
  );
  const [localMaxFDR, setLocalMaxFDR] = useState<number>(maxFDR);
  const [
    localEffectSizeThreshold,
    setLocalEffectSizeThreshold,
  ] = useState<number>(effectSizeThreshold);
  const [localMinMatchingQuery, setLocalMinMatchingQuery] = useState<number>(
    minMatchingQuery || TERM_OPTIONS_FILTER_DEFAULTS.minMatchingQuery
  );
  const [
    localMaxMatchingOverall,
    setLocalMaxMatchingOverall,
  ] = useState<number>(
    maxMatchingOverall || TERM_OPTIONS_FILTER_DEFAULTS.maxMatchingOverall
  );

  return (
    <div ref={ref} style={{ backgroundColor: "#ffffff" }}>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>
        Sort order for selecting top terms{" "}
        <span>
          {" "}
          <PurpleHelpIcon
            tooltipText="Select whether effect size or significance is used to rank terms."
            popoverId="sort-order-help"
          />
        </span>
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
          setValue={setLocalMaxTopTerms}
          defaultValue={TERM_OPTIONS_FILTER_DEFAULTS.maxTopTerms}
        />
        <NumberInput
          name="maxFDR"
          label="FDR Threshold"
          purpleHelpIcon={
            <PurpleHelpIcon
              tooltipText="Select the maximum FDR value used to call a term significantly enriched in the query."
              popoverId="maxFDR-help"
            />
          }
          min={0}
          value={localMaxFDR}
          setValue={setLocalMaxFDR}
          defaultValue={TERM_OPTIONS_FILTER_DEFAULTS.maxFDR}
          step={0.01}
        />
        {/* TODO: Fix. Temporarily hiding. I don't think the api supports this filter yet.
        <NumberInput
          name="effectSizeThreshold"
          label="Effect Size Threshold"
          min={0}
          value={localEffectSizeThreshold}
          setValue={setLocalEffectSizeThreshold}
          defaultValue={DEFAULTS.effectSizeThreshold}
          step={0.01}
        /> */}
        <NumberInput
          name="minMatchingQuery"
          label="Min. n Matching Query"
          purpleHelpIcon={
            <PurpleHelpIcon
              tooltipText="Select the minimum number of genes in the query that a term must match in order to be considered."
              popoverId="minMatchingQuery-help"
            />
          }
          min={0}
          value={localMinMatchingQuery}
          setValue={setLocalMinMatchingQuery}
          defaultValue={TERM_OPTIONS_FILTER_DEFAULTS.minMatchingQuery}
          step={1}
        />
        <NumberInput
          name="maxMatchingOverall"
          label="Max. n Matching Overall"
          purpleHelpIcon={
            <PurpleHelpIcon
              tooltipText="Select the maximum number of genes in the background a term can match and still be considered.  This controls the appearance of common terms."
              popoverId="maxMatchingOverall-help"
            />
          }
          min={0}
          value={localMaxMatchingOverall}
          setValue={setLocalMaxMatchingOverall}
          defaultValue={TERM_OPTIONS_FILTER_DEFAULTS.maxMatchingOverall}
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
              setLocalSortBy(TERM_OPTIONS_FILTER_DEFAULTS.sortBy);
              setLocalMaxFDR(TERM_OPTIONS_FILTER_DEFAULTS.maxFDR);
              setLocalMaxTopTerms(TERM_OPTIONS_FILTER_DEFAULTS.maxTopTerms);
              setLocalMaxMatchingOverall(
                TERM_OPTIONS_FILTER_DEFAULTS.maxMatchingOverall
              );
              setLocalMinMatchingQuery(
                TERM_OPTIONS_FILTER_DEFAULTS.minMatchingQuery
              );
              setLocalEffectSizeThreshold(
                TERM_OPTIONS_FILTER_DEFAULTS.effectSizeThreshold
              );
              handleSetSortBy(
                TERM_OPTIONS_FILTER_DEFAULTS.sortBy as SortOption
              );
              handleSetMaxTopTerms(TERM_OPTIONS_FILTER_DEFAULTS.maxTopTerms);
              handleSetMaxFDR(TERM_OPTIONS_FILTER_DEFAULTS.maxFDR);
              handleSetMaxMatchingOverall(
                TERM_OPTIONS_FILTER_DEFAULTS.maxMatchingOverall
              );
              handleSetMinMatchingQuery(
                TERM_OPTIONS_FILTER_DEFAULTS.minMatchingQuery
              );
              handleSetEffectSizeThreshold(
                TERM_OPTIONS_FILTER_DEFAULTS.effectSizeThreshold
              );
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
