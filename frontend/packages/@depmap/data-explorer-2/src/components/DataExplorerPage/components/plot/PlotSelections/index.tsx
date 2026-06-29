import React, { useCallback, useContext, useRef, useMemo } from "react";
import { Button } from "react-bootstrap";
import { DataExplorerPlotResponse, DataExplorerPlotType } from "@depmap/types";
import { SectionStackContext } from "../../SectionStack";
import HelpTip from "../../HelpTip";
import LabelsVirtualList from "./LabelsVirtualList";
import VisualizeButton from "./VisualizeButton";
import selectionsToHtml from "./selectionsToHtml";
import styles from "../../../styles/DataExplorer2.scss";

interface Props {
  data: DataExplorerPlotResponse | null;
  plot_type: DataExplorerPlotType | null;
  selectedIds: Set<string> | null;
  onClickVisualizeSelected: (e: React.MouseEvent) => void;
  onClickSaveSelectionAsContext: () => void;
  onClickClearSelection?: () => void;
  onClickSetSelectionFromContext?: () => void;
}

const SECTION_HEIGHT_WITHOUT_LIST = 194;

function PlotSelections({
  data,
  plot_type,
  selectedIds,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickClearSelection = undefined,
  onClickSetSelectionFromContext = undefined,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { sectionHeights } = useContext(SectionStackContext);

  const maxHeightOfList =
    selectedIds &&
    selectedIds.size > 0 &&
    plot_type !== "correlation_heatmap"
      ? sectionHeights[1] - SECTION_HEIGHT_WITHOUT_LIST
      : Infinity;

  const [ids, labels] = useMemo(() => {
    if (!data) {
      return [[], []];
    }
    const selectedIndexIds: string[] = [];
    const displayLabels: string[] = [];
    // De-dupe by index id. Under group_by === "expansion" the selection is
    // collapsed to models, but `data.index_ids` still carries one row per
    // (model, transcript) point, so a single selected model matches many rows
    // here. Resolve each selected model to one entry — the first row wins, and
    // since every row of a model shares its index id and index label that pick
    // is well-defined. Without this the list, the count, and the Visualize /
    // Save-as-context affordances all over-count an expanded selection. For the
    // unexpanded and pair-grained paths the ids are already unique, so the guard
    // never fires and behavior (including row order) is unchanged.
    const seen = new Set<string>();

    for (let i = 0; i < data.index_ids.length; i += 1) {
      const id = data.index_ids[i];
      if (selectedIds?.has(id) && !seen.has(id)) {
        seen.add(id);
        selectedIndexIds.push(id);
        displayLabels.push(data.index_labels[i]);
      }
    }

    return [selectedIndexIds, displayLabels];
  }, [data, selectedIds]);

  const handleCopy = useCallback(() => {
    const w = window.open("");

    if (w) {
      w.document.write(selectionsToHtml(ids.length > 0 ? ids : labels));
    }
  }, [ids, labels]);

  return (
    <div>
      <div className={styles.plotInstructions}>
        <div>
          Select points to populate list
          <HelpTip id="select-points-help" />
        </div>
        {onClickClearSelection && selectedIds && selectedIds.size > 0 && (
          <div>
            <button
              className={styles.setSelectionButton}
              type="button"
              onClick={onClickClearSelection}
            >
              clear {selectedIds.size.toLocaleString()} selected{" "}
              {selectedIds.size === 1 ? "point" : "points"}
            </button>
          </div>
        )}
        {onClickSetSelectionFromContext && !selectedIds && (
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
            ids={ids}
            labels={labels}
            maxHeight={maxHeightOfList}
            index_type={data?.index_type as string}
            slice_type={data?.dimensions?.x?.slice_type as string}
            plot_type={plot_type as string}
          />
        </div>
        <div className={styles.plotSelectionsButtons}>
          <VisualizeButton
            numSelected={labels.length}
            onClickVisualizeSelected={onClickVisualizeSelected}
            isCustomData={["custom", null, undefined].includes(
              data?.dimensions?.x.slice_type
            )}
          />
          <Button onClick={handleCopy} disabled={labels.length < 1}>
            Copy
            <span className="glyphicon glyphicon-copy" />
          </Button>
          <Button
            type="button"
            disabled={
              labels.length < 1 ||
              !onClickSaveSelectionAsContext ||
              data?.index_type === "other"
            }
            onClick={onClickSaveSelectionAsContext}
          >
            Save as Context +
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PlotSelections;
