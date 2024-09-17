import React, { useCallback, useRef, useState } from "react";
import CellLineSelectorModal from "./CellLineSelectorModal";

export default function useCellLineSelectorModal() {
  const [show, setShow] = useState(false);
  const initialSelection = useRef<Set<string>>(new Set());
  const useModelNames = useRef(false);
  const mode = useRef<"edit" | "create">("edit");
  const onSelect = useRef(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (updatedList: string[], contextName?: string) => {}
  );
  const onCancel = useRef(() => {});

  const editInCellLineSelector = useCallback(
    (
      modelNamesOrIDs: string[],
      shouldUseModelNames: boolean
    ): Promise<string[]> => {
      initialSelection.current = new Set(modelNamesOrIDs);
      useModelNames.current = shouldUseModelNames;
      mode.current = "edit";
      setShow(true);

      return new Promise((resolve) => {
        onSelect.current = (updatedList) => {
          resolve(updatedList);
          setShow(false);
        };

        onCancel.current = () => {
          resolve(modelNamesOrIDs);
          setShow(false);
        };
      });
    },
    []
  );

  const createNewInCellLineSelector = useCallback((): Promise<{
    lines: string[];
    contextName: string;
  }> => {
    initialSelection.current = new Set();
    useModelNames.current = true;
    mode.current = "create";
    setShow(true);

    return new Promise((resolve) => {
      onSelect.current = (lines, contextName) => {
        resolve({ lines, contextName: contextName as string });
        setShow(false);
      };

      onCancel.current = () => {
        resolve({ lines: [], contextName: "" });
        setShow(false);
      };
    });
  }, []);

  return {
    isCellLineSelectorVisible: show,
    editInCellLineSelector,
    createNewInCellLineSelector,
    CellLineSelectorModal: () => {
      return show ? (
        <CellLineSelectorModal
          mode={mode.current}
          initialSelection={initialSelection.current}
          onSelect={onSelect.current}
          onCancel={onCancel.current}
          useModelNames={useModelNames.current}
        />
      ) : null;
    },
  };
}
