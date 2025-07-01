import React, { useRef } from "react";
import { Brush } from "@visx/brush";
import { scaleLinear } from "d3-scale";
import { PatternLines } from "@visx/pattern";
import BrushHandle from "./BrushHandle";

interface Props {
  containerWidth: number | undefined;
  dataLength: number;
  range: [number, number];
  onChangeRange: (range: [number, number]) => void;
  zoomDomain: [number, number]; // NEW: total zoomable domain
  onBrushDragActive?: (active: boolean) => void; // NEW
}

function HeatmapBrush({
  containerWidth,
  dataLength,
  range,
  onChangeRange,
  selectedColumns,
  zoomDomain,
  onBrushDragActive,
}: Props & { selectedColumns?: Set<number> }) {
  const height = 20;
  const leftMargin = 82;
  const handleSize = 8;
  const brushRef: React.ComponentProps<typeof Brush>["innerRef"] = useRef(null);
  const width = containerWidth ? containerWidth - leftMargin : 1000;

  // Use zoomDomain for the xScale domain, not [range[0], range[1]]
  const xScale = scaleLinear().domain(zoomDomain).range([0, width]);
  // This is a dummy scale that just sets a fixed height.
  const yScale = scaleLinear().domain([0, height]).range([0, height]);

  // Use range for brush position
  const brushStart = range[0];
  const brushEnd = range[1];

  // Compute a stable key for the brush that only changes when selectedColumns changes
  const brushKey = React.useMemo(() => {
    if (selectedColumns && selectedColumns.size > 0) {
      return Array.from(selectedColumns)
        .map(Number)
        .sort((a, b) => a - b)
        .join("-");
    }
    return "default";
  }, [selectedColumns]);

  return (
    <div style={{ position: "absolute" }}>
      <div
        style={{
          position: "relative",
          left: leftMargin,
          top: -98,
          width,
          height: height + 2,
          border: "1px solid #aaa",
          borderRadius: 5,
          backgroundColor: "#f9f9f9",
        }}
      >
        <svg width={width} height={height}>
          <PatternLines
            id="brush-pattern"
            height={6}
            width={6}
            stroke="#666"
            strokeWidth={1}
            orientation={["diagonal"]}
          />

          <Brush
            key={brushKey}
            innerRef={brushRef}
            xScale={xScale}
            yScale={yScale}
            width={width}
            height={height}
            margin={{ top: 0, left: 0, bottom: 0, right: 0 }}
            handleSize={handleSize}
            resizeTriggerAreas={["left", "right"]}
            brushDirection="horizontal"
            initialBrushPosition={{
              start: { x: xScale(brushStart) },
              end: { x: xScale(brushEnd) },
            }}
            onChange={(brush) => {
              if (brush) {
                // Allow drag across full data domain, even if selected columns are dragged out of view.
                let start = Math.floor(brush.x0);
                let end = Math.ceil(brush.x1);
                start = Math.max(start, -1);
                end = Math.min(end, dataLength);
                onChangeRange([start, end]);
              } else {
                // If brush is cleared (e.g., click outside), just reset to current range
                onChangeRange(range);
              }
            }}
            onBrushStart={() => {
              if (onBrushDragActive) onBrushDragActive(true);
            }}
            onBrushEnd={() => {
              if (onBrushDragActive) onBrushDragActive(false);
            }}
            useWindowMoveEvents
            selectedBoxStyle={{ fill: "#C7C7C7" }}
            renderBrushHandle={(props) => <BrushHandle {...props} />}
          />
        </svg>
      </div>
    </div>
  );
}

export default HeatmapBrush;
