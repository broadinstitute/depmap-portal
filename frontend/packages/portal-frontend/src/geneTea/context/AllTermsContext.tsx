import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

export interface AllTermsContextType {
  selectedPlotOrTableTerms: Set<string>;
  handleClearPlotAndTableSelection: () => void;
  handleSetPlotOrTableSelectedTerms: (
    selections: Set<string>,
    shiftKey: boolean
  ) => void;
}

export const AllTermsContext = createContext<AllTermsContextType | undefined>(
  undefined
);

interface AllTermsContextProviderProps {
  children: ReactNode;
}

export function AllTermsContextProvider({
  children,
}: AllTermsContextProviderProps) {
  const [selectedPlotOrTableTerms, setSelectedPlotOrTableTerms] = useState<
    Set<string>
  >(new Set([]));

  const handleSetPlotOrTableSelectedTerms = useCallback(
    (selections: Set<string>, shiftKey: boolean) => {
      setSelectedPlotOrTableTerms((prev) => {
        const next: Set<string> = shiftKey ? new Set(prev) : new Set();

        selections.forEach((id) => {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });

        return next;
      });
    },
    []
  );

  const handleClearPlotAndTableSelection = useCallback(
    () => setSelectedPlotOrTableTerms(new Set([])),
    []
  );

  return (
    <AllTermsContext.Provider
      value={{
        selectedPlotOrTableTerms,
        handleSetPlotOrTableSelectedTerms,
        handleClearPlotAndTableSelection,
      }}
    >
      {children}
    </AllTermsContext.Provider>
  );
}

export function useAllTermsContext() {
  const ctx = useContext(AllTermsContext);
  if (!ctx) {
    throw new Error(
      "useAllTermsContext must be used within AllTermsContext.Provider"
    );
  }
  return ctx;
}
