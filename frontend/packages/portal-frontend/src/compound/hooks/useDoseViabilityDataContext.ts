import { useContext } from "react";
import { DoseViabilityDataContext } from "./DoseViabilityDataContext";

export function useDoseViabilityDataContext() {
  const ctx = useContext(DoseViabilityDataContext);
  if (!ctx) {
    throw new Error(
      "useDoseViabilityDataContext must be used within a DoseTableDataProvider"
    );
  }
  return ctx;
}
