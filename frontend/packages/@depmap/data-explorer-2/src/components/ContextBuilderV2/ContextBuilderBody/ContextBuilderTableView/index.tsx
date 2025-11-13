import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import SliceTable from "@depmap/slice-table";
import { areSliceQueriesEqual, SliceQuery } from "@depmap/types";
import { isCompleteExpression } from "../../../../utils/misc";
import { useContextBuilderState } from "../../state/ContextBuilderState";
import NumberOfMatches from "../Expression/NumberOfMatches";
import useMatches from "../../hooks/useMatches";
import confirmManualSelectMode from "./confirmManualSelectMode";
import styles from "../../../../styles/ContextBuilderV2.scss";

function ContextBuilderTableView() {
  const {
    dimension_type,
    isManualSelectMode,
    mainExpr,
    name,
    replaceExprWithSimpleList,
    setIsReadyToSave,
    setShowTableView,
    setTableOnlySlices,
    tableOnlySlices,
    undoManualSelectionMode,
    uniqueVariableSlices,
  } = useContextBuilderState();

  const wasLoading = useRef(false);
  const { isLoading, matchingIds } = useMatches(mainExpr);
  const [isViewInitialized, setIsViewInitialized] = useState(isLoading);

  useEffect(() => {
    if (!isCompleteExpression(mainExpr)) {
      setIsViewInitialized(false);
    }
  }, [mainExpr]);

  const viewOnlySlices = useRef<Set<SliceQuery>>(new Set(uniqueVariableSlices));
  const initialSlices = useRef([...viewOnlySlices.current, ...tableOnlySlices]);

  useEffect(() => {
    if (isLoading) {
      setIsReadyToSave(false);
    } else {
      setIsReadyToSave(matchingIds.length > 0);

      if (wasLoading.current) {
        setIsViewInitialized(true);
      }
    }

    wasLoading.current = isLoading;
  }, [isLoading, matchingIds, setIsReadyToSave]);

  const initialRowSelection = useMemo(() => {
    const rowSelection: Record<string, boolean> = {};
    matchingIds.forEach((id) => {
      rowSelection[id] = true;
    });

    return rowSelection;
    // We only want to set the initialRowSelection on initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewInitialized]);

  const handleChangeSlices = useCallback(
    (updatedSlices: SliceQuery[]) => {
      const tableSlices = updatedSlices.filter((slice) => {
        return !uniqueVariableSlices.find((varSlice) =>
          areSliceQueriesEqual(varSlice, slice)
        );
      });

      setTableOnlySlices(tableSlices);
    },
    [uniqueVariableSlices, setTableOnlySlices]
  );

  const shouldConfirmRowSelection = useRef(false);

  const handleChangeRowSelection = useCallback(
    (nextRowSelection: Record<string, boolean>) => {
      const selectedIds = Object.entries(nextRowSelection)
        .filter(([, included]) => included)
        .map(([id]) => id);

      replaceExprWithSimpleList(selectedIds);
      shouldConfirmRowSelection.current = true;
    },
    [replaceExprWithSimpleList]
  );

  useEffect(() => {
    if (isManualSelectMode && shouldConfirmRowSelection.current) {
      shouldConfirmRowSelection.current = false;

      confirmManualSelectMode().then((confirmed) => {
        if (!confirmed) {
          setIsViewInitialized(false);
          undoManualSelectionMode();
        }
      });
    }
  }, [isManualSelectMode, undoManualSelectionMode]);

  if (!isViewInitialized) {
    return (
      <div className={styles.ContextBuilderTableView}>
        <div className={styles.spinner}>
          <Spinner position="absolute" left="calc(50vw - 100px)" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ContextBuilderTableView}>
      <SliceTable
        downloadFilename={name}
        index_type_name={dimension_type}
        initialSlices={initialSlices.current}
        onChangeSlices={handleChangeSlices}
        viewOnlySlices={viewOnlySlices.current}
        enableRowSelection
        onChangeRowSelection={handleChangeRowSelection}
        initialRowSelection={initialRowSelection}
        renderCustomControls={() => {
          return isManualSelectMode ? (
            <div className={styles.manualSelectionControls}>
              You’re now in manual selection mode.{" "}
              <Button
                bsStyle="info"
                onClick={() => {
                  setIsViewInitialized(false);
                  undoManualSelectionMode();
                }}
              >
                Restore previous rules
              </Button>
            </div>
          ) : null;
        }}
        renderCustomActions={() => {
          return (
            <div className={styles.customTableControls}>
              <Button onClick={() => setShowTableView(false)}>
                <i className="glyphicon glyphicon-tasks" />
                <span> View as rules</span>
              </Button>
              <NumberOfMatches expr={mainExpr} showNumCandidates />
            </div>
          );
        }}
      />
    </div>
  );
}

export default ContextBuilderTableView;
