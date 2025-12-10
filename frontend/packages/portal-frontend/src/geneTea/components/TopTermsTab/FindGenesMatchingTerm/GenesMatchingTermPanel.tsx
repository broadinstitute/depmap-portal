import styles from "../../../styles/GeneTea.scss";
import React, { useMemo, useState } from "react";
import Select from "react-select";
import { useGeneTeaFiltersContext } from "src/geneTea/context/GeneTeaFiltersContext";
import MatchingTermsModal from "./MatchingTermsModal";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";
import { Radio } from "react-bootstrap";

interface GenesMatchingTermPanelProps {
  rawData: GeneTeaEnrichedTerms | null;
  termGroupToTermsMapping: Map<string, string[]>;
  termToMatchingGenesMap: Map<string, string[]>;
  useTerms: boolean;
}

const GenesMatchingTermPanel: React.FC<GenesMatchingTermPanelProps> = ({
  rawData,
  termGroupToTermsMapping,
  termToMatchingGenesMap,
  useTerms,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<any>(null);
  const [useAllGenes, setUseAllGenes] = useState<boolean>(false);

  const termOrGroupSelectOptions = useMemo(() => {
    const options = useTerms
      ? Array.from(new Set(rawData?.allEnrichedTerms?.term)).map(
          (term: string) => {
            return {
              value: term,
              label: term,
            };
          }
        )
      : Array.from(new Set(rawData?.allEnrichedTerms?.termGroup)).map(
          (termGroup: string) => {
            return {
              value: termGroup,
              label: termGroup,
            };
          }
        );

    return options;
  }, [rawData, useTerms]);

  return (
    <div className={styles.GeneTeaMatchingTermPanel}>
      <div>
        <Radio
          style={{ marginBottom: "3px" }}
          name="radioGroup"
          checked={useAllGenes}
          onChange={() => {
            setUseAllGenes(true);
          }}
          inline
        >
          All Genes
        </Radio>
        <Radio
          style={{ marginBottom: "3px" }}
          name="radioGroup"
          checked={!useAllGenes}
          onChange={() => {
            setUseAllGenes(false);
          }}
          inline
        >
          Query Genes
        </Radio>
        <Select
          value={
            selectedTerm
              ? { value: selectedTerm.value, label: selectedTerm.label }
              : null
          }
          isDisabled={termOrGroupSelectOptions.length === 0}
          options={termOrGroupSelectOptions}
          onChange={(selection: any) => {
            if (selection) {
              setSelectedTerm({
                value: selection.value,
                label: selection.label,
              });
            }
          }}
        />
      </div>
      <MatchingTermsModal
        show={Boolean(selectedTerm?.value)}
        termOrTermGroup={selectedTerm?.value || ""}
        termsWithinSelectedGroup={
          useTerms || !selectedTerm
            ? null
            : termGroupToTermsMapping.get(selectedTerm.value) || null
        }
        termToMatchingGenesMap={termToMatchingGenesMap}
        onClose={() => setSelectedTerm(null)}
        useTerms={useTerms}
        useAllGenes={useAllGenes}
      />
    </div>
  );
};

export default GenesMatchingTermPanel;
