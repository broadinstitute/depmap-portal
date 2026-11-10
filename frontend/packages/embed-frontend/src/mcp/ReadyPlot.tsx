import React, { useEffect, useMemo, useState } from "react";
import useSelection from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks/useSelection";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import { PlotView } from "../components/Plot";
import {
  buttonLabel,
  MAX_SELECTED_ENTITIES,
  selectedEntities,
  selectionMessage,
} from "./selection";

// The height of the row under the plot, which holds the "Open in Data
// Explorer" link and the selection controls. Part of the sizing the comments in
// McpView protect: the document height is a function of the plot (and of
// whether the row exists) alone.
export const LINK_ROW_HEIGHT = 28;

type PlotData = DataExplorerPlotResponse & {
  plot_config: DataExplorerPlotConfig;
  linreg_by_group?: LinRegInfo[];
};

interface SendMessageResult {
  isError?: boolean;
}

interface Props {
  data: PlotData;
  height: number;
  link: string | null;
  plotKey: number;
  // False while the plot is scrolled out of view (it is unmounted then).
  showPlot: boolean;
  // Shown in place of the plot when WebGL could not be recovered.
  fallback: React.ReactNode;
  // True when the host declares it accepts `ui/message` text.
  canSendMessages: boolean;
  // Returns false when there is no host to ask, so the link just navigates.
  onOpenLink: (url: string) => boolean;
  sendMessage: (text: string) => Promise<SendMessageResult>;
}

const buttonStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 3,
  background: "#fff",
  padding: "0 8px",
  height: 22,
  lineHeight: "20px",
  marginRight: 4,
  cursor: "pointer",
  fontSize: 12,
};

function ReadyPlot({
  data,
  height,
  link,
  plotKey,
  showPlot,
  fallback,
  canSendMessages,
  onOpenLink,
  sendMessage,
}: Props) {
  const plotConfig = data.plot_config;
  // Plot types that can be selected on.
  const isHeatmap = plotConfig.plot_type === "correlation_heatmap";
  const isSelectable =
    isHeatmap ||
    plotConfig.plot_type === "scatter" ||
    plotConfig.plot_type === "density_1d" ||
    plotConfig.plot_type === "waterfall";

  // Data Explorer's own selection logic, so a selection here means exactly
  // what it means there.
  const {
    selection,
    pairGrained,
    selectedPoints,
    pointsToAnnotate,
    handleClickPoint,
    handleMultiselect,
    clearSelection,
  } = useSelection(data, plotConfig.facet_by);

  const offered = canSendMessages && isSelectable;
  // A point is an (entity, member) pair, so a selection has no single meaning.
  // (The heatmap is never expanded and has its own selection, below.)
  const selectionOff = offered && !isHeatmap && pairGrained;
  const selectionOn = offered && (isHeatmap || !pairGrained);

  const [sendFailed, setSendFailed] = useState(false);
  // The heatmap's selection: the ids of the pair of entities in a clicked cell.
  const [heatmapIds, setHeatmapIds] = useState<Set<string> | null>(null);

  const entities = useMemo(() => {
    if (!isHeatmap) {
      return selectedEntities(data, selectedPoints);
    }

    const points = new Set<number>();

    (data.index_ids ?? []).forEach((id, i) => {
      if (heatmapIds?.has(id)) {
        points.add(i);
      }
    });

    return selectedEntities(data, points);
  }, [data, isHeatmap, selectedPoints, heatmapIds]);

  useEffect(() => {
    setSendFailed(false);
  }, [entities]);

  const plotSelection = useMemo(
    () =>
      selectionOn && !isHeatmap
        ? {
            selectedPoints,
            pointsToAnnotate,
            selectionCount: selection?.size ?? 0,
            onClickPoint: handleClickPoint,
            onMultiselect: handleMultiselect,
            onClickResetSelection: clearSelection,
            modebarSelectionTools: true,
          }
        : undefined,
    [
      selectionOn,
      selectedPoints,
      pointsToAnnotate,
      selection,
      handleClickPoint,
      handleMultiselect,
      clearSelection,
    ]
  );

  const heatmapSelection = useMemo(
    () =>
      selectionOn && isHeatmap
        ? {
            selectedLabels: heatmapIds ?? new Set<string>(),
            onSelectLabels: (ids: string[]) => setHeatmapIds(new Set(ids)),
          }
        : undefined,
    [selectionOn, isHeatmap, heatmapIds]
  );

  const hasRow = Boolean(link) || offered;
  const overCap = entities.length > MAX_SELECTED_ENTITIES;

  // The only place a message is sent, and only from a click.
  const ask = async () => {
    if (entities.length === 0 || overCap) {
      return;
    }

    setSendFailed(false);

    try {
      const result = await sendMessage(selectionMessage(data, entities));

      if (result?.isError) {
        setSendFailed(true);
      }
    } catch (e) {
      setSendFailed(true);
    }
  };

  let plot: React.ReactNode = null;

  if (showPlot) {
    plot = (
      <PlotView
        key={plotKey}
        plotConfig={plotConfig}
        data={data}
        linreg_by_group={data.linreg_by_group}
        height={height}
        selection={plotSelection}
        heatmapSelection={heatmapSelection}
      />
    );
  }

  const ellipsis: React.CSSProperties = {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: height + (hasRow ? LINK_ROW_HEIGHT : 0),
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{fallback || plot}</div>
      {hasRow && (
        <div
          style={{
            flex: "0 0 auto",
            height: LINK_ROW_HEIGHT,
            lineHeight: `${LINK_ROW_HEIGHT}px`,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0, ...ellipsis }}>
            {selectionOn && (
              <>
                {entities.length > 0 && (
                  <button
                    type="button"
                    disabled={overCap}
                    style={{
                      ...buttonStyle,
                      cursor: overCap ? "not-allowed" : "pointer",
                    }}
                    onClick={ask}
                  >
                    {buttonLabel(entities.length, data.index_display_name)}
                  </button>
                )}
                {entities.length === 0 && (
                  <span style={{ color: "#666", fontSize: 12 }}>
                    {isHeatmap
                      ? "Click a cell to select the pair it compares."
                      : "Use the box or lasso tool in the plot's toolbar to select points."}
                  </span>
                )}
                {sendFailed && (
                  <span style={{ color: "#a94442", fontSize: 12 }}>
                    Couldn&apos;t add the selection to the message box.
                  </span>
                )}
              </>
            )}
            {selectionOff && (
              <span style={{ color: "#666", fontSize: 12 }}>
                Selecting points is not available when points are colored by an
                expansion.
              </span>
            )}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              style={{ flex: "0 0 auto" }}
              onClick={(e) => {
                // A sandboxed iframe can't navigate on its own; ask the host.
                if (onOpenLink(link)) {
                  e.preventDefault();
                }
              }}
            >
              Open in Data Explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default ReadyPlot;
