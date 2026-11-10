import React, { useEffect, useMemo, useState } from "react";
import useSelection from "@depmap/data-explorer-2/src/components/DataExplorerPage/hooks/useSelection";
import type ExtendedPlotType from "@depmap/data-explorer-2/src/components/DataExplorerPage/ExtendedPlotType";
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

type Dragmode = "zoom" | "select" | "lasso";

const DRAGMODES: { mode: Dragmode; label: string; title: string }[] = [
  { mode: "zoom", label: "Zoom", title: "Drag to zoom" },
  { mode: "select", label: "Box", title: "Drag to select points in a box" },
  { mode: "lasso", label: "Lasso", title: "Drag to select points freehand" },
];

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
  // True only in a host known to turn a message into an unsent draft.
  canDraftMessages: boolean;
  // Returns false when there is no host to ask, so the link just navigates.
  onOpenLink: (url: string) => boolean;
  sendMessage: (text: string) => Promise<SendMessageResult>;
}

const smallButton = (active: boolean): React.CSSProperties => ({
  border: "1px solid #ccc",
  borderRadius: 3,
  background: active ? "#e6e6e6" : "#fff",
  padding: "0 8px",
  height: 22,
  lineHeight: "20px",
  marginRight: 4,
  cursor: "pointer",
  fontSize: 12,
});

function ReadyPlot({
  data,
  height,
  link,
  plotKey,
  showPlot,
  fallback,
  canDraftMessages,
  onOpenLink,
  sendMessage,
}: Props) {
  const plotConfig = data.plot_config;
  const isScatter = plotConfig.plot_type === "scatter";

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

  const offered = canDraftMessages && isScatter;
  // A point is an (entity, member) pair, so a selection has no single meaning.
  const selectionOff = offered && pairGrained;
  const selectionOn = offered && !pairGrained;

  const [plotElement, setPlotElement] = useState<ExtendedPlotType | null>(null);
  const [dragmode, setDragmode] = useState<Dragmode>("zoom");
  const [sendFailed, setSendFailed] = useState(false);

  // Re-applied whenever the plot is redrawn (a remount starts in zoom mode).
  useEffect(() => {
    if (selectionOn) {
      plotElement?.setDragmode(dragmode);
    }
  }, [selectionOn, plotElement, dragmode]);

  const entities = useMemo(() => selectedEntities(data, selectedPoints), [
    data,
    selectedPoints,
  ]);

  useEffect(() => {
    setSendFailed(false);
  }, [entities]);

  const scatterSelection = useMemo(
    () =>
      selectionOn
        ? {
            selectedPoints,
            pointsToAnnotate,
            selectionCount: selection?.size ?? 0,
            onClickPoint: handleClickPoint,
            onMultiselect: handleMultiselect,
            onClickResetSelection: clearSelection,
            onLoad: setPlotElement,
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
        selection={scatterSelection}
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
                {DRAGMODES.map(({ mode, label, title }) => (
                  <button
                    key={mode}
                    type="button"
                    title={title}
                    style={smallButton(dragmode === mode)}
                    onClick={() => setDragmode(mode)}
                  >
                    {label}
                  </button>
                ))}
                {entities.length > 0 && (
                  <button
                    type="button"
                    disabled={overCap}
                    style={{
                      ...smallButton(false),
                      cursor: overCap ? "not-allowed" : "pointer",
                    }}
                    onClick={ask}
                  >
                    {buttonLabel(entities.length, data.index_display_name)}
                  </button>
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
