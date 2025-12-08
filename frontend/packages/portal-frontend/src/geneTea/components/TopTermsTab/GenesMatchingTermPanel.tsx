import styles from "../styles/GeneTea.scss";
import React, { useMemo, useState } from "react";
import Select from "react-select";
import { useGeneTeaFiltersContext } from "src/geneTea/context/GeneTeaFiltersContext";
import MatchingTermsModal from "./MatchingTermsModal";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";

interface GenesMatchingTermPanelProps {
  rawData: GeneTeaEnrichedTerms | null;
  termGroupToTermMapping: Map<string, string>;
  queryGenes: string[];
  termToMatchingGenesMap: Map<string, string[]>;
  groupByTerms: boolean;
}

const GenesMatchingTermPanel: React.FC<GenesMatchingTermPanelProps> = ({
  rawData,
  termGroupToTermMapping,
  queryGenes,
  termToMatchingGenesMap,
  groupByTerms,
}) => {
  const { allAvailableGenes } = useGeneTeaFiltersContext();

  const [selectedTerm, setSelectedTerm] = useState<any>(null);

  const termsFromTermGroups = useMemo(() => {
    if (!rawData || !rawData.allEnrichedTerms) return [];

    return rawData?.groupby === "Term"
      ? rawData?.allEnrichedTerms?.term
      : rawData?.allEnrichedTerms?.termGroup.map((termGroup) => {
          const val = termGroupToTermMapping.get(termGroup);
          if (val) {
            return val;
          }
          return termGroup;
        });
  }, [rawData, termGroupToTermMapping]);

  const termGroupSelectOptions = Array.from(
    new Set(rawData?.allEnrichedTerms?.termGroup)
  ).map((termGroup: string) => {
    const term = termGroupToTermMapping.get(termGroup);
    return {
      value: term,
      label: termGroup,
    };
  });

  const matchingGenes = useMemo(
    () => termToMatchingGenesMap.get(selectedTerm?.value) || [],
    [selectedTerm, termToMatchingGenesMap]
  );

  return (
    <div
      style={{
        minWidth: 0,
        overflow: "visible",
        zIndex: "9999",
      }}
    >
      <div>
        <Select
          value={
            selectedTerm
              ? { value: selectedTerm.term, label: selectedTerm.term }
              : null
          }
          isDisabled={termSelectOptions.length === 0}
          options={termSelectOptions}
          onChange={(selection: any) => {
            if (selection) {
              setSelectedTerm({
                value: selection.value,
                label: selection.value,
              });
            }
          }}
        />
      </div>
      <MatchingTermsModal
        show={Boolean(selectedTerm?.value)}
        term={selectedTerm?.value || ""}
        synonyms={[]}
        coincident={[]}
        matchingGenes={matchingGenes}
        onClose={() => setSelectedTerm(null)}
        groupByTerms={groupByTerms}
      />
    </div>
  );
};

export default GenesMatchingTermPanel;
