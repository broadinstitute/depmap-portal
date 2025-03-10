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
    const indexLabels = data?.index_labels || [];
    const modelLabels = data?.index_aliases?.[0]?.values || [];
    const mapping = new Map(
      indexLabels.map((label, i) => [label, modelLabels[i]])
    );

    const outIds: string[] = [];
    const outLabels: string[] = [];

    for (let i = 0; i < indexLabels.length; i += 1) {
      const label = indexLabels[i];

      if (selectedLabels?.has(label)) {
        const alias = mapping.get(label);

        if (alias) {
          outIds.push(label);
          outLabels.push(alias);
        } else {
          outLabels.push(label);
        }
      }
    }

    return [outIds, outLabels];
  }, [data?.index_aliases, data?.index_labels, selectedLabels]);

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
