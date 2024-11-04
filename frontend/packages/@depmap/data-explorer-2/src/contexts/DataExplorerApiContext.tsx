import React, { createContext, useContext, useMemo } from "react";
import {
  DataExplorerContextVariable,
  DataExplorerContextV2,
} from "@depmap/types";

export type VariableDomain =
  | {
      value_type: "categorical";
      unique_values: string[];
    }
  | {
      value_type: "list_strings";
      unique_values: string[];
    }
  | {
      value_type: "continuous";
      min: number;
      max: number;
    };

const defaultValue = {
  evaluateContext: (
    context: Omit<DataExplorerContextV2, "name">
  ): Promise<{ ids: string[]; labels: string[]; num_candidates: number }> => {
    window.console.log("evaluateContext:", { context });
    throw new Error("Not implemented");
  },

  fetchVariableDomain: (
    variable: DataExplorerContextVariable
  ): Promise<VariableDomain> => {
    window.console.log("fetchVariableDomain:", { variable });
    throw new Error("Not implemented");
  },
};

export const DataExplorerApiContext = createContext(defaultValue);

export const useDataExplorerApi = () => {
  return useContext(DataExplorerApiContext);
};

export const DataExplorerApiProvider = ({
  evaluateContext,
  fetchVariableDomain,
  children,
}: {
  evaluateContext: typeof defaultValue["evaluateContext"];
  fetchVariableDomain: typeof defaultValue["fetchVariableDomain"];
  children: React.ReactNode;
}) => {
  const value = useMemo(() => {
    return {
      evaluateContext,
      fetchVariableDomain,
    };
  }, [evaluateContext, fetchVariableDomain]);

  return (
    <DataExplorerApiContext.Provider value={value}>
      {children}
    </DataExplorerApiContext.Provider>
  );
};
