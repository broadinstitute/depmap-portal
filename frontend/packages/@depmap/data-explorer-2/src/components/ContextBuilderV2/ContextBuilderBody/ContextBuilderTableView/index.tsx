import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { Spinner } from "@depmap/common-components";
import SliceTable from "@depmap/slice-table";
import { areSliceQueriesEqual, SliceQuery } from "@depmap/types";
import { isCompleteExpression } from "../../../../utils/misc";
import {
  DEFAULT_EMPTY_EXPR,
  useContextBuilderState,
} from "../../state/ContextBuilderState";
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

  const [isViewInitialized, setIsViewInitialized] = useState(false);
  const { isLoading, matchingIds } = useMatches(mainExpr);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (mainExpr === DEFAULT_EMPTY_EXPR) {
      setIsViewInitialized(true);
    } else if (!isCompleteExpression(mainExpr)) {
      setIsViewInitialized(false);
    }
  }, [mainExpr]);

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

  const sliceTableRef = useRef<{ forceInitialize: () => void }>(null);
  const shouldInitTable = useRef(false);

  useEffect(() => {
    if (isManualSelectMode && shouldConfirmRowSelection.current) {
      shouldConfirmRowSelection.current = false;
      sliceTableRef.current?.forceInitialize();

      confirmManualSelectMode().then((confirmed) => {
        if (!confirmed) {
          shouldInitTable.current = true;
          setIsViewInitialized(false);
          undoManualSelectionMode();
        }
      });
    }
  }, [isManualSelectMode, undoManualSelectionMode]);

  useEffect(() => {
    if (shouldInitTable.current) {
      shouldInitTable.current = false;
      sliceTableRef.current?.forceInitialize();
    }
  }, [isManualSelectMode]);

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
        sliceTableRef={sliceTableRef}
        getInitialState={() => {
          return {
            initialSlices: [...uniqueVariableSlices, ...tableOnlySlices],
            viewOnlySlices: new Set(uniqueVariableSlices),
            initialRowSelection: Object.fromEntries(
              matchingIds.map((id) => [id, true])
            ),
          };
        }}
        downloadFilename={name}
        index_type_name={dimension_type}
        onChangeSlices={handleChangeSlices}
        enableRowSelection
        onChangeRowSelection={handleChangeRowSelection}
        renderCustomControls={() => {
          return isManualSelectMode ? (
            <div className={styles.manualSelectionControls}>
              You’re now in manual selection mode.{" "}
              <Button
                bsStyle="info"
                onClick={() => {
                  shouldInitTable.current = true;
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
