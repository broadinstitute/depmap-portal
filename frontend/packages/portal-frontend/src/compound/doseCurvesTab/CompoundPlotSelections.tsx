import React, { useContext, useRef } from "react";
import { Button } from "react-bootstrap";
import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/DataExplorer2.scss";
import LabelsVirtualList from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/PlotSelections/LabelsVirtualList";
import { SectionStackContext } from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/SectionStack";
import HelpTip from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/HelpTip";

interface CompoundPlotSelectionsProps {
  selectedIds: Set<string> | null;
  selectedLabels: Set<string> | null;
  onClickSaveSelectionAsContext: () => void;
  onClickClearSelection?: () => void;
  onClickSetSelectionFromContext?: () => void;
}

const SECTION_HEIGHT_WITHOUT_LIST = 194;

function CompoundPlotSelections({
  selectedIds,
  selectedLabels,
  onClickSaveSelectionAsContext,
  onClickClearSelection = undefined,
  onClickSetSelectionFromContext = undefined,
}: CompoundPlotSelectionsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { sectionHeights } = useContext(SectionStackContext);

  const maxHeightOfList =
    selectedLabels && selectedLabels.size > 0
      ? sectionHeights[1] - SECTION_HEIGHT_WITHOUT_LIST
      : Infinity;

  return (
    <div style={{ border: "1px solid #b8b8b8" }}>
      <div
        style={{
          color: "#FFFFFF",
          backgroundColor: "#7B8CB2",
          paddingTop: "10px",
          paddingBottom: "10px",
          paddingLeft: "15px",
          fontSize: "16px",
          fontWeight: "700",
          fontFamily: "Lato",
        }}
      >
        Plot Selections
      </div>
      <div style={{ margin: "15px" }}>
        <div className={styles.plotInstructions}>
          <div>
            Select points to populate list
            <HelpTip id="select-points-help" />
          </div>
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
          {onClickSetSelectionFromContext && !selectedLabels && (
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

export default CompoundPlotSelections;
