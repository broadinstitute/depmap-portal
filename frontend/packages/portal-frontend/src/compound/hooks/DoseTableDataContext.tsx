import React, { useContext, ReactNode } from "react";
import { DRCDatasetOptions } from "@depmap/types";
import useDoseTableData from "./useDoseTableData";
import { TableFormattedData } from "../types";

export interface DoseTableDataContextType {
  tableFormattedData: TableFormattedData | null;
  doseColumnNames: string[];
  error: boolean;
  isLoading: boolean;
}

export const DoseTableDataContext = React.createContext<
  DoseTableDataContextType | undefined
>(undefined);

interface DoseTableDataProviderProps {
  dataset: DRCDatasetOptions | null;
  compoundId: string;
  children: ReactNode;
}

export function DoseTableDataProvider({
  dataset,
  compoundId,
  children,
}: DoseTableDataProviderProps) {
  const value = useDoseTableData(dataset, compoundId);
  return (
    <DoseTableDataContext.Provider value={value}>
      {children}
    </DoseTableDataContext.Provider>
  );
}

export function useDoseTableDataContext() {
  const ctx = useContext(DoseTableDataContext);
  if (!ctx) {
    throw new Error(
      "useDoseTableDataContext must be used within a DoseTableDataProvider"
    );
  }
  return ctx;
}
