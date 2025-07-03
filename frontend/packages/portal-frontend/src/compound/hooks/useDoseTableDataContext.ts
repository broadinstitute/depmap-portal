import { useContext } from "react";
import { DoseTableDataContext } from "./DoseTableDataContext";

export function useDoseTableDataContext() {
  const ctx = useContext(DoseTableDataContext);
  if (!ctx) {
    throw new Error(
      "useDoseTableDataContext must be used within a DoseTableDataProvider"
    );
  }
  return ctx;
}
