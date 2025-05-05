import React from "react";
import { Group } from "@visx/group";
import { BrushHandleRenderProps } from "@visx/brush/lib/BrushHandle";

// We need to manually offset the handles for them to be rendered at the right position
function BrushHandle({
  x,
  className,
  width,
  height,
  isBrushActive,
}: BrushHandleRenderProps) {
  if (!isBrushActive) {
    return null;
  }

  const top = 0.5;
  const innerTop = top + 3.5;
  const bottom = top + height - 1;
  const innerBottom = bottom - 3.5;

  return (
    <Group left={x + (className === "visx-brush-handle-left" ? width : 0)}>
      <path
        fill="#f2f2f2"
        d={`
          M -4.5 ${top}
          L 3.5 ${top}
          L 3.5 ${bottom}
          L -4.5 ${bottom}
          L -4.5 ${top}
          M -1.5 ${innerTop}
          L -1.5 ${innerBottom}
          M 0.5 ${innerTop}
          L 0.5 ${innerBottom}
      `}
        stroke="#999"
        strokeWidth="1"
        style={{ cursor: "ew-resize" }}
      />
    </Group>
  );
}

export default BrushHandle;
