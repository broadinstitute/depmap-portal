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
  selectedLabels: Set<string> | null;
  onClickVisualizeSelected: (e: React.MouseEvent) => void;
  onClickSaveSelectionAsContext: () => void;
  onClickClearSelection?: () => void;
  onClickSetSelectionFromContext?: () => void;
}

const SECTION_HEIGHT_WITHOUT_LIST = 194;

function PlotSelections({
  data,
  plot_type,
  selectedLabels,
  onClickVisualizeSelected,
  onClickSaveSelectionAsContext,
  onClickClearSelection = undefined,
  onClickSetSelectionFromContext = undefined,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { sectionHeights } = useContext(SectionStackContext);

  const maxHeightOfList =
    selectedLabels &&
    selectedLabels.size > 0 &&
    plot_type !== "correlation_heatmap"
      ? sectionHeights[1] - SECTION_HEIGHT_WITHOUT_LIST
      : Infinity;

  const [ids, labels] = useMemo(() => {
    if (!data) {
      return [[], []];
    }
    const indexLabels: string[] = [];
    const displayLabels: string[] = [];

    for (let i = 0; i < data.index_labels.length; i += 1) {
      if (selectedLabels?.has(data.index_labels[i])) {
        indexLabels.push(data.index_labels[i]);
        displayLabels.push((data.index_display_labels || data.index_labels)[i]);
      }
    }

    return [indexLabels, displayLabels];
  }, [data, selectedLabels]);

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
            isCustomData={data?.dimensions?.x.slice_type === "custom"}
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
