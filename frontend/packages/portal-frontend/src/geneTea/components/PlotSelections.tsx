import React, { useRef } from "react";
import { Button } from "react-bootstrap";
import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/DataExplorer2.scss";
import LabelsVirtualList from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/PlotSelections/LabelsVirtualList";
import geneTeaStyles from "../styles/GeneTea.scss";

interface PlotSelectionsProps {
  selectedIds: Set<string> | null;
  selectedLabels: Set<string> | null;
  onClickSaveSelectionAsContext: () => void;
  onClickClearSelection?: () => void;
  onClickSetSelectionFromContext?: () => void;
}

function PlotSelections({
  selectedIds,
  selectedLabels,
  onClickSaveSelectionAsContext,
  onClickClearSelection = undefined,
  onClickSetSelectionFromContext = undefined,
}: PlotSelectionsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const maxHeightOfList = 400;

  return (
    <div className={geneTeaStyles.PlotSelections}>
      <div className={geneTeaStyles.headerDiv}>Plot Selections</div>
      <div className={geneTeaStyles.mainContent}>
        <div className={styles.plotInstructions}>
          <div>Select cell lines to populate list</div>
          {onClickClearSelection && selectedLabels && selectedLabels.size > 0 && (
            <div>
              <button
                className={styles.setSelectionButton}
                type="button"
                onClick={onClickClearSelection}
              >
                clear {selectedLabels.size.toLocaleString()} selected{" "}
                {selectedLabels.size === 1 ? "point" : "points"}
              </button>
            </div>
          )}
          {onClickSetSelectionFromContext &&
            selectedLabels &&
            selectedLabels.size === 0 && (
              <div>
                or{" "}
                <button
                  type="button"
                  className={styles.setSelectionButton}
                  onClick={onClickSetSelectionFromContext}
                >
                  set selection from a context
                </button>
              </div>
            )}
        </div>
        <div className={styles.plotSelectionsContent}>
          <div ref={listRef}>
            <LabelsVirtualList
              ids={selectedIds ? Array.from(selectedIds) : []}
              labels={selectedLabels ? Array.from(selectedLabels) : []}
              maxHeight={maxHeightOfList}
              index_type={"depmap_model"}
              slice_type={"random fill in val"}
              plot_type={"random fill in val"}
            />
          </div>
          <div className={styles.plotSelectionsButtons}>
            <Button
              type="button"
              disabled={
                (selectedLabels && selectedLabels.size < 1) ||
                !onClickSaveSelectionAsContext
              }
              onClick={onClickSaveSelectionAsContext}
            >
              Save as Context +
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlotSelections;
