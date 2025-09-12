import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "react-bootstrap";
import SliceTable from "@depmap/slice-table";
import { areSliceQueriesEqual, SliceQuery } from "@depmap/types";
import { useContextBuilderState } from "../../state/ContextBuilderState";
import NumberOfMatches from "../Expression/NumberOfMatches";
import useMatches from "../../hooks/useMatches";
import styles from "../../../../styles/ContextBuilderV2.scss";

function ContextBuilderTableView() {
  const {
    dimension_type,
    mainExpr,
    setShowTableView,
    uniqueVariableSlices,
    tableOnlySlices,
    setTableOnlySlices,
    name,
    setIsReadyToSave,
  } = useContextBuilderState();

  const { isLoading, matchingIds } = useMatches(mainExpr);

  useEffect(() => {
    if (isLoading) {
      setIsReadyToSave(false);
    } else {
      setIsReadyToSave(matchingIds.length > 0);
    }
  }, [isLoading, matchingIds, setIsReadyToSave]);

  const viewOnlySlices = useRef<Set<SliceQuery>>(new Set(uniqueVariableSlices));
  const initialSlices = useRef([...viewOnlySlices.current, ...tableOnlySlices]);

  const initialRowSelection = useMemo(() => {
    const rowSelection: Record<string, boolean> = {};
    matchingIds.forEach((id) => {
      rowSelection[id] = true;
    });

    return rowSelection;
  }, [matchingIds]);

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.ContextBuilderTableView}>
      <SliceTable
        downloadFilename={name}
        index_type_name={dimension_type}
        initialSlices={initialSlices.current}
        onChangeSlices={handleChangeSlices}
        viewOnlySlices={viewOnlySlices.current}
        initialRowSelection={initialRowSelection}
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
