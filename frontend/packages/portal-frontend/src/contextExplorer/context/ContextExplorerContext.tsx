import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export interface ContextExplorerContextType {
  checkedDatatypes: Set<string>;
  handleSetCheckedDatatypes: (datatypes: Set<string>) => void;
}

export const ContextExplorerContext = createContext<
  ContextExplorerContextType | undefined
>(undefined);

interface ContextExplorerContextProviderProps {
  children: ReactNode;
}

export function ContextExplorerContextProvider({
  children,
}: ContextExplorerContextProviderProps) {
  const [checkedDatatypes, setCheckedDatatypes] = useState<Set<string>>(
    new Set()
  );

  const handleSetCheckedDatatypes = useCallback(
    (datatypes: Set<string>) => setCheckedDatatypes(datatypes),
    []
  );

  return (
    <ContextExplorerContext.Provider
      value={{
        checkedDatatypes,
        handleSetCheckedDatatypes,
      }}
    >
      {children}
    </ContextExplorerContext.Provider>
  );
}

export function useContextExplorerContext() {
  const ctx = useContext(ContextExplorerContext);
  if (!ctx) {
    throw new Error(
      "useContextExplorerContext must be used within ContextExplorerContext.Provider"
    );
  }
  return ctx;
}
