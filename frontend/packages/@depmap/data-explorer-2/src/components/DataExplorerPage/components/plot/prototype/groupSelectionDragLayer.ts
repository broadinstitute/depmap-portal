/* eslint-disable no-nested-ternary, no-param-reassign */
// groupSelectionDragLayer.ts
//
// Custom box/lasso drag for the `enforceSingleGroupSelection` mode, shared by
// PrototypeDensity1D (groups are violin tracks on the y-axis) and
// PrototypeScatterPlot/waterfall (groups are rank regions on the x-axis). When
// the mode is on, Plotly's own select/lasso is turned off (dragmode:false) and
// this module owns the drag, drawing a marquee that is *clamped to the region
// the drag started in* and cannot escape into a neighbouring group.
//
// FIRST PASS — VISUAL FEEDBACK ONLY. This module draws the (clamped) marquee
// and nothing else. It does not compute or emit a selection; resolving the
// selected point set is handled separately, later. It never calls onMultiselect
// and never touches Plotly's selection machinery.
//
// The constrained axis and the region layout differ per plot, expressed by the
// live config on `plot.__groupSel` (rewritten by the renderer on every effect
// run). Two region models are supported:
//
//   * violinTracks (density, axis "y"): tracks live at integer y0s. The anchor
//     is NOT guessed from the start position; it is deferred until the drag box
//     first touches a point (see the renderer's plotly_selecting), so a click in
//     a gap is resolved by what it actually hits rather than by geometry.
//
//   * ranges (waterfall, axis "x"): an explicit, pre-sorted list of regions
//     with [lo, hi) data-coordinate bounds (gap midpoints, ±Infinity at the
//     ends). A start is resolved by containment; no direction disambiguation.
//
// This module installs its DOM listeners exactly once per plot.
//
// ALTERNATIVE WORTH CONSIDERING (faceting). Everything below — the interceptor,
// the pixel clamp, the l2p/box-select basis skew, the renderer's resolveRange
// commit fence, and the waterfall's rank-skip gap hack that fakes spacing
// between groups — exists to carve one shared coordinate space into per-group
// regions at runtime. Plotly already confines a box/lasso drag to a single
// subplot, so faceting by group (one panel per group, only while
// enforceSingleGroupSelection is on) would make the single-group constraint
// STRUCTURAL instead of enforced, deleting all of that machinery and the whole
// class of pixel-degeneracy bugs with it (no shared axis left to partition).
// Use `matches: 'y'` so cross-group value comparison survives the split.
//
// It is not a clear win, which is why it is a note and not the implementation:
//   - It changes what the plot *is* on a toggle. Fine if single-group select is
//     a deliberate "focus" view; jarring if it's a quick mode flipped over the
//     same overlaid view (and it discards the shared-axis comparison that makes
//     the combined waterfall worth having).
//   - It does not scale past a handful of groups — nine panels are fine, but the
//     expansion north star (doses, replicates, ...) could blow that up, whereas
//     the shared axis degrades gracefully (selection gets fiddlier, plot stays
//     readable).
//   - It forks the waterfall from the density/violin path, which today share
//     this regionModel + interceptor machinery; faceting violins would be more
//     disruptive still, costing the unified abstraction.
// Net: keep the shared plot as default; reach for facets only if single-group
// select becomes a dedicated view AND group counts stay small. Revisit when the
// "best members" ranking work forces the group-count question anyway.

const BAND_HALF = 0.5; // a violin track at y0 owns the band [y0 - 0.5, y0 + 0.5]
const DRAG_THRESHOLD_PX = 3; // movement below this is treated as a click
// The waterfall clamp window is built from `ax.l2p(v) + ax._offset`, which lands
// ~1px left of the pixel basis Plotly's box-select uses. That single-pixel skew
// simultaneously holds the live box short of a group's rightmost points and lets
// it graze the left neighbour by a pixel. Translate the whole x clamp window
// right by this amount to realign the two bases. resolveRange still fences the
// committed set, so this only affects live reach, never group attribution. Bump
// to 2 if a given zoom's rounding leaves it a hair short. (Waterfall x only;
// density y bands aren't pixel-degenerate and don't need it.)
const WATERFALL_CLAMP_SHIFT_PX = 1;

type RegionKey = number | string | symbol;

export type RegionModel =
  | { kind: "violinTracks"; validKeys: Set<number> }
  | {
      kind: "ranges";
      // pre-sorted ascending by `lo`; first lo = -Infinity, last hi = +Infinity
      regions: { key: RegionKey; lo: number; hi: number }[];
    };

interface BoxShape {
  tool: "box";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface LassoShape {
  tool: "lasso";
  pts: { x: number; y: number }[];
}
type Shape = BoxShape | LassoShape;

export interface GroupSelectionConfig {
  // whether enforceSingleGroupSelection is active AND a select/lasso tool is on
  enabled: boolean;
  tool: "box" | "lasso";
  axis: "x" | "y"; // the constrained axis
  regionModel: RegionModel;
  // persisted geometry of committed shapes (additive shift-select)
  committedShapes: Shape[];
  // the region the whole selection is locked to (null until a fresh drag starts)
  selectionRegionKey: RegionKey | null;
}

type GroupSelectionPlot = HTMLElement & {
  _fullLayout?: any;
  __groupSel?: GroupSelectionConfig;
  __groupSelInstalled?: boolean;
  __groupSelCleanup?: () => void;
  // data-space coordinate (on the constrained axis) of the current drag's start,
  // recorded while the anchor is deferred (kept on the element so it survives
  // the reset re-render). The renderer reads it to resolve the region on the
  // first point contact (density -> violin band y, waterfall -> x-rank).
  __groupSelStartCoord?: number;
};

// --- region resolution (pure) ----------------------------------------------

// Waterfall: resolve a start coordinate (data coords) to the region containing
// it. Regions are sorted and cover the whole axis (±Infinity at the ends).
export function resolveRange(
  regions: { key: RegionKey; lo: number; hi: number }[],
  c: number
): RegionKey | null {
  if (regions.length === 0) {
    return null;
  }
  for (const r of regions) {
    if (c >= r.lo && c < r.hi) {
      return r.key;
    }
  }
  // Shouldn't happen when ends are ±Infinity, but fall back to nearest.
  let best: RegionKey | null = null;
  let bestDist = Infinity;
  for (const r of regions) {
    const center =
      r.lo === -Infinity ? r.hi : r.hi === Infinity ? r.lo : (r.lo + r.hi) / 2;
    const d = Math.abs(center - c);
    if (d < bestDist) {
      bestDist = d;
      best = r.key;
    }
  }
  return best;
}

export default function installGroupSelectionDragLayer(
  plot: GroupSelectionPlot
) {
  if (plot.__groupSelInstalled) {
    return;
  }
  plot.__groupSelInstalled = true;

  // ---- geometry helpers ---------------------------------------------------
  const axisObj = (axis: "x" | "y") =>
    plot._fullLayout[axis === "x" ? "xaxis" : "yaxis"];

  // pixel position relative to the plot div (the coord space zoomlayer uses)
  const mouse = (e: MouseEvent) => {
    const bb = plot.getBoundingClientRect();
    return { x: e.clientX - bb.left, y: e.clientY - bb.top };
  };

  const coordOf = (p: { x: number; y: number }, axis: "x" | "y") =>
    axis === "x" ? p.x : p.y;

  // The plotting-area pixel offset of an axis within the SVG. This is Plotly's
  // own internal value (the same origin l2p/p2d are relative to), so combining
  // `axis.l2p(value) + axis._offset` yields the exact on-screen pixel of a data
  // value — the same coordinate space the zoomlayer marquee is drawn in. We
  // previously derived this from getBoundingClientRect of the draglayer, which
  // doesn't reliably match the axis origin and produced a mis-scaled clamp on
  // the waterfall's x-axis.
  const axisOffset = (axis: "x" | "y") => axisObj(axis)._offset as number;

  // a region's [lo, hi] bounds in data coordinates on the constrained axis
  const regionBoundsData = (
    cfg: GroupSelectionConfig,
    key: RegionKey
  ): [number, number] | null => {
    const m = cfg.regionModel;
    if (m.kind === "violinTracks") {
      const y0 = key as number;
      return [y0 - BAND_HALF, y0 + BAND_HALF];
    }
    const r = m.regions.find((reg) => reg.key === key);
    return r ? [r.lo, r.hi] : null;
  };

  // a region's [min, max] pixel bounds on the constrained axis (plot-div px)
  const regionBoundsPx = (
    cfg: GroupSelectionConfig,
    key: RegionKey
  ): [number, number] | null => {
    const bounds = regionBoundsData(cfg, key);
    if (!bounds) {
      return null;
    }
    const ax = axisObj(cfg.axis);
    const off = axisOffset(cfg.axis);
    const toPx = (v: number) => {
      if (v === Infinity || v === -Infinity) {
        const [r0, r1] = ax.range;
        const rlo = Math.min(r0, r1);
        const rhi = Math.max(r0, r1);
        return ax.l2p(v === -Infinity ? rlo : rhi) + off;
      }
      return ax.l2p(v) + off;
    };
    const a = toPx(bounds[0]);
    const b = toPx(bounds[1]);
    // Strict region bounds — no overflow. The interceptor clamps the live
    // pointer to these, so the native box can't reach a neighbouring region's
    // points. End regions reach the plot edge via the ±Infinity handling above.
    // The whole window is nudged right by WATERFALL_CLAMP_SHIFT_PX to correct a
    // 1px basis skew between this clamp and Plotly's box-select (x only).
    const shift = cfg.axis === "x" ? WATERFALL_CLAMP_SHIFT_PX : 0;
    return [Math.min(a, b) + shift, Math.max(a, b) + shift];
  };

  // ---- transient (per-drag) state -----------------------------------------
  let pending: {
    startX: number;
    startY: number;
    shiftKey: boolean;
  } | null = null;
  let dragging = false;

  // Arm a drag on the first qualifying mousemove. For density we no longer guess
  // a band from gap geometry: we DEFER the anchor until the box first touches a
  // point (resolved in the renderer's plotly_selecting). The waterfall still
  // resolves immediately by containment. Shift-additive keeps the locked region.
  const beginDrag = (): boolean => {
    const cfg = plot.__groupSel!;
    const ax = axisObj(cfg.axis);
    const off = axisOffset(cfg.axis);
    const startConstrainedPx = coordOf(
      { x: pending!.startX, y: pending!.startY },
      cfg.axis
    );
    const startData = ax.p2d(startConstrainedPx - off);

    // additive: the region is locked from a prior drag; the interceptor clamps
    // to it from the first move, so an out-of-region shift-drag can't escape.
    if (pending!.shiftKey && cfg.selectionRegionKey != null) {
      return true;
    }

    // Fresh drag: defer the anchor for BOTH region models. Leave it unset so the
    // interceptor lets Plotly's box grow until it touches a point; the renderer
    // then locks the region to the first contacted point nearest this start
    // (density -> violin band, waterfall -> x-rank range). Recorded on the
    // element so it survives the reset re-render at the start of a drag.
    cfg.selectionRegionKey = null;
    plot.__groupSelStartCoord = startData;
    return true;
  };

  // ---- DOM listeners ------------------------------------------------------
  const onMouseDown = (e: MouseEvent) => {
    const cfg = plot.__groupSel;
    pending = null;
    dragging = false;
    if (!cfg || !cfg.enabled || e.button !== 0) {
      return; // let Plotly handle clicks / its own (disabled) drag
    }
    // Record the start; the anchor region is resolved later (on the first move
    // for the waterfall, on first point contact for density — see beginDrag).
    const pos = mouse(e);
    pending = { startX: pos.x, startY: pos.y, shiftKey: e.shiftKey };
  };

  // On the first move past the click threshold, resolve the anchor region and
  // arm `dragging` (which the interceptor gates on). Plotly draws its own
  // marquee and runs the selection; the interceptor keeps it inside the band.
  const onMouseMove = (e: MouseEvent) => {
    if (!pending || dragging) {
      return;
    }
    const pos = mouse(e);
    if (
      Math.abs(pos.x - pending.startX) < DRAG_THRESHOLD_PX &&
      Math.abs(pos.y - pending.startY) < DRAG_THRESHOLD_PX
    ) {
      return; // still just a click
    }
    if (!beginDrag()) {
      pending = null; // out-of-region shift-drag (or invalid start): rejected
      return;
    }
    dragging = true;
  };

  const onMouseUp = () => {
    pending = null;
    dragging = false;
  };

  // ---- event interceptor (the sole selection-constraint mechanism) ---------
  // Confine Plotly's *native* selection drag to the anchor region by clamping
  // the pointer that feeds it. While a drag is active on this plot (tracked via
  // `dragging`, armed by onMouseMove → beginDrag once the anchor resolves), each
  // real pointer move that would carry Plotly's box/lasso outside the anchor
  // region is swallowed and replaced with a copy whose constrained-axis
  // coordinate is pinned to the region edge. Plotly then selects only in-region
  // points natively (native marquee, live styling, and commit). Our re-dispatched
  // copy has isTrusted === false, so we don't reprocess it. Works for both region
  // models: density clamps clientY to a violin band, the waterfall clamps clientX
  // to an x-rank range (strict bounds — see regionBoundsPx).
  let interceptDragTarget: EventTarget | null = null;

  const regionClientBounds = (
    cfg: GroupSelectionConfig,
    key: RegionKey
  ): [number, number] | null => {
    const px = regionBoundsPx(cfg, key); // plot-div px on the constrained axis
    if (!px) {
      return null;
    }
    const rect = plot.getBoundingClientRect();
    const origin = cfg.axis === "x" ? rect.left : rect.top;
    return [px[0] + origin, px[1] + origin];
  };

  const onInterceptMove = (e: MouseEvent | PointerEvent) => {
    const cfg = plot.__groupSel;
    // Only while a real group-select drag is active on THIS plot.
    if (!dragging || !cfg || !cfg.enabled) {
      return;
    }
    if (!e.isTrusted) {
      return; // our own clamped copy — let it reach Plotly
    }
    if (cfg.selectionRegionKey == null) {
      return; // anchor not resolved yet — let Plotly run normally this tick
    }
    const bounds = regionClientBounds(cfg, cfg.selectionRegionKey);
    if (!bounds) {
      return;
    }
    const coord = cfg.axis === "x" ? e.clientX : e.clientY;
    const clamped = Math.max(bounds[0], Math.min(bounds[1], coord));
    if (clamped === coord) {
      return; // already inside the region — let the real event through
    }

    if (!interceptDragTarget) {
      interceptDragTarget = e.target;
    }
    e.stopImmediatePropagation();
    e.preventDefault();

    const Ctor = e.constructor as typeof MouseEvent;
    const init: MouseEventInit & {
      pointerId?: number;
      pointerType?: string;
      isPrimary?: boolean;
    } = {
      clientX: cfg.axis === "x" ? clamped : e.clientX,
      clientY: cfg.axis === "y" ? clamped : e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      cancelable: true,
      view: window,
    };
    const pe = e as PointerEvent;
    if (pe.pointerId !== undefined) {
      init.pointerId = pe.pointerId;
      init.pointerType = pe.pointerType;
      init.isPrimary = pe.isPrimary;
    }
    (interceptDragTarget || e.target!).dispatchEvent(new Ctor(e.type, init));
  };

  const onInterceptUp = () => {
    interceptDragTarget = null;
  };

  plot.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onInterceptMove, true);
  window.addEventListener("pointermove", onInterceptMove, true);
  window.addEventListener("mouseup", onInterceptUp, true);
  window.addEventListener("pointerup", onInterceptUp, true);

  plot.__groupSelCleanup = () => {
    plot.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onInterceptMove, true);
    window.removeEventListener("pointermove", onInterceptMove, true);
    window.removeEventListener("mouseup", onInterceptUp, true);
    window.removeEventListener("pointerup", onInterceptUp, true);
    plot.__groupSelInstalled = false;
  };
}
