import type { Layout } from "plotly.js";
import {
  captureAnnotationTail,
  captureTransientState,
  cloneFigureForExport,
} from "../plotUtils";

// A stand-in for the live graph div's layout, shaped like the renderers leave
// it: axes with autorange already turned off and a zoom the user set, and
// per-point annotations carrying the smuggled `pointIndex` plus whatever tail
// offsets the user dragged them to.
const makeLayout = () =>
  (({
    xaxis: {
      range: [1, 2],
      autorange: false,
      title: { text: "x" },
      tickfont: { size: 14 },
    },
    yaxis: {
      range: [3, 4],
      autorange: false,
      title: { text: "y" },
      tickfont: { size: 14 },
    },
    annotations: [
      { pointIndex: 7, ax: 10, ay: -20, text: "SOX10" },
      { pointIndex: 9, ax: -5, ay: 15, text: "BRAF" },
    ],
    shapes: [{ type: "line", x0: 0 }],
    legend: { title: { text: "Age" }, font: { size: 14 } },
  } as unknown) as Partial<Layout>);

describe("captureTransientState", () => {
  test("carries over the zoom with autorange off", () => {
    const { axes } = captureTransientState({ layout: makeLayout() });

    expect(axes.xaxis).toMatchObject({ range: [1, 2], autorange: false });
    expect(axes.yaxis).toMatchObject({ range: [3, 4], autorange: false });
  });

  test("pins autorange off even when the live plot left it on", () => {
    const layout = makeLayout() as any;
    layout.xaxis.autorange = true;

    const { axes } = captureTransientState({ layout });

    // Otherwise a fresh instance would recompute its own extents and throw
    // away the very zoom we are carrying over.
    expect((axes.xaxis as any).autorange).toBe(false);
  });

  test("keys dragged annotation tails by point index", () => {
    const { annotationTails } = captureTransientState({ layout: makeLayout() });

    // Stored as angle+distance+fontSize, not raw ax/ay — see
    // captureAnnotationTail's own comment for why — so the expected values
    // are derived the same way rather than hand-computed.
    expect(annotationTails).toEqual({
      "x-y-7": captureAnnotationTail(10, -20, 12),
      "x-y-9": captureAnnotationTail(-5, 15, 12),
    });
  });

  test("ignores annotations that are not per-point labels", () => {
    const layout = makeLayout() as any;
    // The over-cap "(N selected points)" summary: paper-anchored, no tail, and
    // no pointIndex. It must not land in the tails map as an "undefined" key.
    layout.annotations.push({ text: "(500 selected points)" });
    layout.annotations.push({ ax: 1, ay: 2, text: "no point index" });

    const { annotationTails } = captureTransientState({ layout });

    expect(Object.keys(annotationTails).sort()).toEqual(["x-y-7", "x-y-9"]);
  });

  test("survives a plot with no annotations at all", () => {
    expect(captureTransientState({ layout: {} }).annotationTails).toEqual({});
  });

  test("does not alias the live layout's axis objects", () => {
    const layout = makeLayout();
    const { axes } = captureTransientState({ layout });

    // The renderers mutate their stored axes in place when a font size
    // changes. If this aliased, a preview would silently retune the main plot.
    (axes.xaxis as any).tickfont = { size: 40 };

    expect((layout.xaxis as any).tickfont).toEqual({ size: 14 });
  });
});

describe("cloneFigureForExport", () => {
  test("copies every object an export may write to", () => {
    const layout = makeLayout();
    const trace = {
      marker: { size: 10, line: { width: 2 } },
      selected: { marker: { opacity: 1 } },
      unselected: { marker: { opacity: 0.1 } },
      hoverlabel: { bgcolor: "#fff" },
    };

    const figure = cloneFigureForExport([trace], layout);
    const outTrace = figure.data[0] as any;
    const outLayout = figure.layout as any;

    expect(outTrace).not.toBe(trace);
    expect(outTrace.marker).not.toBe(trace.marker);
    expect(outTrace.marker.line).not.toBe(trace.marker.line);
    expect(outTrace.selected).not.toBe(trace.selected);
    expect(outTrace.unselected).not.toBe(trace.unselected);
    expect(outTrace.hoverlabel).not.toBe(trace.hoverlabel);

    expect(outLayout.xaxis).not.toBe((layout as any).xaxis);
    expect(outLayout.xaxis.title).not.toBe((layout as any).xaxis.title);
    expect(outLayout.xaxis.tickfont).not.toBe((layout as any).xaxis.tickfont);
    expect(outLayout.annotations).not.toBe((layout as any).annotations);
    expect(outLayout.annotations[0]).not.toBe((layout as any).annotations[0]);
    expect(outLayout.shapes[0]).not.toBe((layout as any).shapes[0]);
    expect(outLayout.legend.font).not.toBe((layout as any).legend.font);
  });

  test("copies the axes of a faceted plot, not just the first pair", () => {
    const layout = ({
      xaxis: { range: [0, 1] },
      xaxis2: { range: [0, 2] },
      yaxis3: { range: [0, 3] },
    } as unknown) as Partial<Layout>;

    const outLayout = cloneFigureForExport([], layout).layout as any;

    expect(outLayout.xaxis2).not.toBe((layout as any).xaxis2);
    expect(outLayout.yaxis3).not.toBe((layout as any).yaxis3);
    expect(outLayout.xaxis2).toEqual({ range: [0, 2] });
  });

  test("shares the big read-only arrays rather than copying them", () => {
    const x = [1, 2, 3];
    const y = [4, 5, 6];
    const color = [0.1, 0.2, 0.3];
    const selectedpoints = [0, 2];
    const trace = { x, y, selectedpoints, marker: { color } };

    const outTrace = cloneFigureForExport([trace], {}).data[0] as any;

    // Deep-copying these would mean megabytes of churn per preview render.
    expect(outTrace.x).toBe(x);
    expect(outTrace.y).toBe(y);
    expect(outTrace.selectedpoints).toBe(selectedpoints);
    expect(outTrace.marker.color).toBe(color);
  });

  test("leaves the source figure untouched when the copy is written to", () => {
    const layout = makeLayout();
    const trace = { marker: { size: 10, line: { width: 2 } }, uid: undefined };

    const figure = cloneFigureForExport([trace], layout);

    // Stand in for what Plotly's newPlot does to a figure it is handed.
    (figure.data[0] as any).uid = "abc123";
    (figure.data[0] as any).marker.size = 99;
    (figure.layout as any).xaxis.range = [-100, 100];
    (figure.layout as any).annotations[0].ax = 999;

    expect(trace.uid).toBeUndefined();
    expect(trace.marker.size).toBe(10);
    expect((layout as any).xaxis.range).toEqual([1, 2]);
    expect((layout as any).annotations[0].ax).toBe(10);
  });

  test("tolerates a layout with no axes, annotations, shapes or legend", () => {
    expect(cloneFigureForExport([], {})).toEqual({ data: [], layout: {} });
  });
});
