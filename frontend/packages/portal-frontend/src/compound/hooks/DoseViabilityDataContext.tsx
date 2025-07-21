import React, { useContext, ReactNode } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import useDoseViabilityData from "./useDoseViabilityData";

export interface DoseViabilityDataContextType {
  tableFormattedData: any;
  doseCurveData: any;
  doseColumnNames: string[];
  doseMin: number | null;
  doseMax: number | null;
  error: boolean;
  isLoading: boolean;
}

export const DoseViabilityDataContext = React.createContext<
  DoseViabilityDataContextType | undefined
>(undefined);

interface DoseViabilityDataProviderProps {
  dataset: DRCDatasetOptions | null;
  compoundId: string;
  children: ReactNode;
}

export function DoseViabilityDataProvider({
  dataset,
  compoundId,
  children,
}: DoseViabilityDataProviderProps) {
  const value = useDoseViabilityData(dataset, compoundId);
  return (
    <DoseViabilityDataContext.Provider value={value}>
      {children}
    </DoseViabilityDataContext.Provider>
  );
}

export function useDoseViabilityDataContext() {
  const ctx = useContext(DoseViabilityDataContext);
  if (!ctx) {
    throw new Error(
      "useDoseViabilityDataContext must be used within a DoseTableDataProvider"
    );
  }
  return ctx;
}
