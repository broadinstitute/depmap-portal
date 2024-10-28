import React, { createContext, useContext, useMemo } from "react";
import { DataExplorerContextVariable } from "@depmap/types";

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
  fetchVariableDomain,
  children,
}: {
  fetchVariableDomain: typeof defaultValue["fetchVariableDomain"];
  children: React.ReactNode;
}) => {
  const value = useMemo(() => {
    return { fetchVariableDomain };
  }, [fetchVariableDomain]);

  return (
    <DataExplorerApiContext.Provider value={value}>
      {children}
    </DataExplorerApiContext.Provider>
  );
};
