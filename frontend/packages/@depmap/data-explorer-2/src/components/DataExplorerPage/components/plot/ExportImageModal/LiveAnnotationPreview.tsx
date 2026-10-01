import React, { useEffect, useRef } from "react";
import type Plotly from "plotly.js";
import type { Config, Data, Layout } from "plotly.js";
import type ExtendedPlotType from "../../../ExtendedPlotType";
import {
  AnnotationTail,
  captureAnnotationTail,
  releaseWebglContexts,
} from "../prototype/plotUtils";
import styles from "../../../styles/ExportImageModal.scss";

type PlotlyType = typeof Plotly;

interface Props {
  plotly: PlotlyType;
  figure: { data: object[]; layout: Partial<Layout> };
  // Every per-point annotation this modal builds already carries its own
  // font.size (see each renderer's own annotation-construction code) — this
  // is only a defensive fallback for the rare case one doesn't.
  fallbackFontSize: number;
  onAnnotationDrag: (pointIndex: number, tail: AnnotationTail) => void;
}

// A real, interactive Plotly instance of the exact figure getImageFigure()
// just produced — not ExportImageModal's other, off-screen "live settings"
// instance, which diverges from the real export on several export-only
// options (chrome line width, edge padding, legend substitution, tick font
// size — see that instance's own comment). Exists for exactly one
// interaction: Plotly's native `edits.annotationTail` tail-dragging, already
// enabled unconditionally by every renderer (see e.g. PrototypeScatterPlot's
// own `config`), surfaced here where the user can actually see and reach
// it. See ExportImageModal's "Adjust label positions" toggle, the only
// caller.
export default function LiveAnnotationPreview({
  plotly,
  figure,
  fallbackFontSize,
  onAnnotationDrag,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // A ref, not a dependency: the figure-sync effect below must not
  // re-attach the listener just because a parent re-render handed it a new
  // callback instance.
  const onAnnotationDragRef = useRef(onAnnotationDrag);
  onAnnotationDragRef.current = onAnnotationDrag;

  // Mounts once. Plots the figure available at that moment and attaches the
  // relayout listener and resize observer to this same node for its whole
  // lifetime; the effect below keeps the figure itself in sync via
  // Plotly.react on the same node (which updates in place, never
  // remounting) rather than this effect re-running — tearing this down and
  // recreating it on every figure change would also abort a drag gesture in
  // progress if the two ever raced. `.on`/`.removeListener` only exist on a
  // div after Plotly has plotted into it at least once, which is why the
  // initial plot call has to happen here too, not solely in that effect.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const config: Partial<Config> = {
      displayModeBar: false,
      // The whole reason this component exists: the same per-point label
      // dragging the live, on-screen plot already allows.
      edits: { annotationTail: true },
      // Not `responsive: true` — `figure.layout` carries an explicit
      // width/height (set by ExportImageModal, matching the real export's
      // own render size) specifically so this stays pixel-faithful rather
      // than fitting itself to this container. Scrolling to reach whatever
      // doesn't fit is the container's own CSS job (see .preview), not a
      // resize.
    };

    const plot = (container as unknown) as ExtendedPlotType;

    plotly.react(plot, figure.data as Data[], figure.layout, config);

    const handleRelayout = () => {
      (plot.layout.annotations ?? []).forEach((annotation) => {
        const { ax, ay, font } = annotation as {
          ax?: number;
          ay?: number;
          font?: { size?: number };
        };
        const { pointIndex } = annotation as { pointIndex?: number };

        if (ax != null && ay != null && typeof pointIndex === "number") {
          onAnnotationDragRef.current(
            pointIndex,
            captureAnnotationTail(ax, ay, font?.size ?? fallbackFontSize)
          );
        }
      });
    };

    plot.on("plotly_relayout", handleRelayout);

    // Real, non-zero dimensions are required — a hidden or collapsed
    // container breaks Plotly the same way PrototypeScatterPlot's own note
    // on ResizeObserver/Plots.resize warns about for its off-screen
    // instance.
    const resizeObserver = new ResizeObserver(() => {
      plotly.Plots.resize(plot);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      plot.removeListener("plotly_relayout", handleRelayout);
      releaseWebglContexts(container);
      plotly.purge(container);
    };
    // Only `plotly` — the figure is applied once here, at mount, and kept
    // current by the effect below, which reuses this same node rather than
    // re-running this setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotly]);

  // Re-syncs the chart in place whenever the export settings behind
  // `figure` change while this view is open (a style or label edit made
  // without leaving adjust mode should still show up). Plotly.react diffs
  // and updates without disturbing the container, so a change that doesn't
  // touch annotations can't interrupt a drag in progress.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    plotly.react(
      (container as unknown) as ExtendedPlotType,
      figure.data as Data[],
      figure.layout
    );
  }, [plotly, figure]);

  // The raster preview's own pane sets `overflow` inline per its fit/actual
  // zoom mode (see ExportImageModal.scss's own note on why `.preview` has no
  // default) — this view has no such toggle, so it always allows scrolling:
  // without it, a plot taller or wider than the fixed box (see .preview's
  // height) has nowhere to go but out, over whatever sits below it in the
  // modal, with no way to reach the part that overflowed.
  return (
    <div
      ref={containerRef}
      className={styles.preview}
      style={{ overflow: "auto" }}
    />
  );
}
