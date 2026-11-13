import { useCallback } from "react";
import type {
  LegendKey,
  useLegendState,
} from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/plotUtils";

// Adapts Data Explorer's legend state (the toggle/isolate logic behind its
// PlotLegend) to Plotly's own legend, which is all an embed has. Plotly
// reports a single and a double click as separate events, whereas
// onClickLegendItem detects a double click as two clicks on the same key in
// quick succession (isolate / show all) — so a double click is replayed as
// exactly that.
export default function useBuiltinLegendClick(
  legendState: ReturnType<typeof useLegendState>,
  colorMap: Map<LegendKey, string>
) {
  const { onClickLegendItem } = legendState;

  return useCallback(
    (key: LegendKey, isDoubleClick: boolean) => {
      const catColorMap = Object.fromEntries(colorMap);

      onClickLegendItem(key, catColorMap);

      if (isDoubleClick) {
        onClickLegendItem(key, catColorMap);
      }
    },
    [onClickLegendItem, colorMap]
  );
}
