import styles from "../styles/GeneTea.scss";
import React, { useMemo, useState } from "react";
import GeneTeaContextModal from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaContextModal";
import Select from "react-select";
import { useGeneTeaFiltersContext } from "src/geneTea/context/GeneTeaFiltersContext";

interface GenesMatchingTermPanelProps {
  validTerms: string[];
  queryGenes: string[];
  termToMatchingGenesMap: Map<string, string[]>;
}

const GenesMatchingTermPanel: React.FC<GenesMatchingTermPanelProps> = ({
  validTerms,
  queryGenes,
  termToMatchingGenesMap,
}) => {
  const { allAvailableGenes } = useGeneTeaFiltersContext();

  const [selectedTerm, setSelectedTerm] = useState<any>(null);

  const termSelectOptions = validTerms.map((term: string) => {
    return {
      value: term,
      label: term,
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
      <GeneTeaContextModal
        show={Boolean(selectedTerm?.value)}
        term={selectedTerm?.value || ""}
        synonyms={[]}
        coincident={[]}
        matchingGenes={matchingGenes}
        onClose={() => setSelectedTerm(null)}
      />
    </div>
  );
};

export default GenesMatchingTermPanel;
