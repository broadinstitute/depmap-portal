import React, { useRef } from "react";
import { Brush } from "@visx/brush";
import { scaleLinear } from "d3-scale";
import { PatternLines } from "@visx/pattern";
import BrushHandle from "./BrushHandle";

interface Props {
  containerWidth: number | undefined;
  dataLength: number;
  initialRange: [number, number];
  onChangeRange: (range: [number, number]) => void;
}

function HeatmapBrush({
  containerWidth,
  dataLength,
  initialRange,
  onChangeRange,
}: Props) {
  const height = 20;
  const leftMargin = 90;
  const handleSize = 8;
  const brushRef: React.ComponentProps<typeof Brush>["innerRef"] = useRef(null);
  const width = containerWidth ? containerWidth - leftMargin : 1000;

  const xScale = scaleLinear().domain([-2, dataLength]).range([0, width]);
  const yScale = scaleLinear().domain([0, height]).range([0, height]);

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
              start: { x: xScale(initialRange[0]) },
              end: { x: xScale(initialRange[1]) },
            }}
            onChange={(range) => {
              if (range) {
                let start = Math.floor(range.x0);
                let end = Math.ceil(range.x1);
                start = Math.max(start, -1);
                end = Math.min(end, dataLength);

                onChangeRange([start, end]);
              } else if (brushRef.current) {
                brushRef.current.updateBrush((prev) => {
                  return {
                    ...prev,
                    start: { ...prev.start, y: 0 },
                    end: { ...prev.end, y: height },
                    extent: {
                      x0: xScale(initialRange[0]),
                      x1: xScale(initialRange[1]),
                      y0: 0,
                      y1: height,
                    },
                  };
                });
              }
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
