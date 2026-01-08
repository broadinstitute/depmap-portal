import React, { useContext, useState, useCallback, ReactNode } from "react";
import { SelectOption } from "../types";

interface CorrelationContextType {
  selectedCorrelatedDatasets: string[];
  selectedDoses: string[];
  allSelectedLabels: Record<string, string[]>;
  handleCorrelatedDatasetsChange: (datasets: any) => void;
  handleDosesChange: (doses: any) => void;
  handleLabelSelection: (ds: string, labels: string[]) => void;
  handleTableSelectionUpdate: (
    selections: string[],
    filteredData: any[],
    selectedRows: Set<string>
  ) => void;
  resetAllLabels: () => void;
}

const CorrelationContextInstance = React.createContext<
  CorrelationContextType | undefined
>(undefined);

interface CorrelationProviderProps {
  children: ReactNode;
}

export function CorrelationProvider({ children }: CorrelationProviderProps) {
  const [selectedCorrelatedDatasets, setSelectedCorrelatedDatasets] = useState<
    string[]
  >([]);
  const [selectedDoses, setSelectedDoses] = useState<string[]>([]);
  const [allSelectedLabels, setAllSelectedLabels] = useState<
    Record<string, string[]>
  >({});

  const handleCorrelatedDatasetsChange = useCallback((datasets: any) => {
    const datasetSelections = datasets?.map(({ value }: SelectOption) => value);
    setSelectedCorrelatedDatasets(datasetSelections || []);
  }, []);

  const handleDosesChange = useCallback((doses: string[] | undefined) => {
    setSelectedDoses(doses || []);
  }, []);

  const handleLabelSelection = useCallback((ds: string, labels: string[]) => {
    setAllSelectedLabels((prev) => ({ ...prev, [ds]: labels }));
  }, []);

  const resetAllLabels = useCallback(() => {
    setAllSelectedLabels({});
  }, []);

  const handleTableSelectionUpdate = useCallback(
    (selections: string[], filteredData: any[], selectedRows: Set<string>) => {
      const prevIds = Array.from(selectedRows);
      const isAdding = selections.length > prevIds.length;
      const targetId = isAdding
        ? selections.find((id) => !prevIds.includes(id))
        : prevIds.find((id) => !selections.includes(id));

      const item = filteredData.find((d) => d.id === targetId);
      if (!item) return;

      setAllSelectedLabels((prev) => ({
        ...prev,
        [item.featureDataset]: isAdding
          ? [...(prev[item.featureDataset] || []), item.feature]
          : (prev[item.featureDataset] || []).filter(
              (l: string) => l !== item.feature
            ),
      }));
    },
    []
  );

  const contextValue: CorrelationContextType = {
    selectedCorrelatedDatasets,
    selectedDoses,
    allSelectedLabels,
    handleCorrelatedDatasetsChange,
    handleDosesChange,
    handleLabelSelection,
    handleTableSelectionUpdate,
    resetAllLabels,
  };

  return (
    <CorrelationContextInstance.Provider value={contextValue}>
      {children}
    </CorrelationContextInstance.Provider>
  );
}

export function useCorrelationContext() {
  const context = useContext(CorrelationContextInstance);
  if (!context) {
    throw new Error(
      "useCorrelationContext must be used within a CorrelationProvider"
    );
  }
  return context;
}
