import React, { useCallback, useContext, useRef, useMemo } from "react";
import { Button } from "react-bootstrap";
import { DataExplorerPlotResponse, DataExplorerPlotType } from "@depmap/types";
import { SectionStackContext } from "src/data-explorer-2/components/SectionStack";
import HelpTip from "src/data-explorer-2/components/HelpTip";
import LabelsVirtualList from "src/data-explorer-2/components/plot/PlotSelections/LabelsVirtualList";
import VisualizeButton from "src/data-explorer-2/components/plot/PlotSelections/VisualizeButton";
import selectionsToHtml from "src/data-explorer-2/components/plot/PlotSelections/selectionsToHtml";
import styles from "src/data-explorer-2/styles/DataExplorer2.scss";

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
    selectedLabels && selectedLabels.size > 0
      ? sectionHeights[1] - SECTION_HEIGHT_WITHOUT_LIST
      : Infinity;

  const labels: string[] = useMemo(() => [...(selectedLabels || [])], [
    selectedLabels,
  ]);

  const handleCopy = useCallback(() => {
    const w = window.open("");

    if (w) {
      w.document.write(selectionsToHtml(labels));
    }
  }, [labels]);

  const modelLabelToDisplayNameMap = new Map<string, string>();
  const cell_line_names =
    data?.index_aliases && data?.index_aliases.length > 0
      ? data?.index_aliases.find((alias) => alias.label === "Cell Line Name")!
          .values
      : null;

  if (cell_line_names) {
    data?.index_labels.forEach((label: string, i: number) => {
      modelLabelToDisplayNameMap.set(label, cell_line_names[i]);
    });
  }

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
            displayLabels={
              modelLabelToDisplayNameMap
                ? labels.map((label: string) => {
                    const displayName = modelLabelToDisplayNameMap.get(label);
                    if (displayName) {
                      return `${displayName} (${label})`;
                    }
                    return label;
                  })
                : labels
            }
            labels={labels}
            maxHeight={maxHeightOfList}
            index_type={data?.index_type as string}
            plot_type={plot_type as string}
          />
        </div>
        <div className={styles.plotSelectionsButtons}>
          <VisualizeButton
            numSelected={labels.length}
            onClickVisualizeSelected={onClickVisualizeSelected}
            isCustomData={data?.dimensions?.x.entity_type === "custom"}
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
