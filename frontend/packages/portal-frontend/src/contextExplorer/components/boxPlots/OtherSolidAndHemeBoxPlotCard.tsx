import React from "react";
import { Panel } from "react-bootstrap";
import { BoxPlotInfo } from "src/contextExplorer/models/types";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
} from "src/contextExplorer/utils";
import BoxPlot from "./BoxPlot";

interface OtherSolidAndHemeBoxPlotsProps {
  otherBoxData: BoxPlotInfo[];
  xAxisRange: any[];
  entityType: string;
  drugDottedLine?: number;
}

export function OtherSolidAndHemeBoxPlots({
  otherBoxData,
  xAxisRange,
  entityType,
  drugDottedLine = undefined,
}: OtherSolidAndHemeBoxPlotsProps) {
  return (
    <Panel eventKey="OTHER">
      <Panel.Body>
        {" "}
        <div>
          {otherBoxData.length > 0 ? (
            <BoxPlot
              plotName="other solid and heme"
              boxData={otherBoxData}
              xAxisRange={xAxisRange}
              plotHeight={
                otherBoxData.length * BOX_THICKNESS +
                BOX_PLOT_TOP_MARGIN +
                BOX_PLOT_BOTTOM_MARGIN
              }
              bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
              topMargin={BOX_PLOT_TOP_MARGIN}
              dottedLinePosition={
                entityType === "gene" ? -1 : drugDottedLine || -1.74
              }
            />
          ) : (
            <div>
              <h4>No Other Solid or Heme Models Available</h4>
            </div>
          )}
        </div>
      </Panel.Body>
    </Panel>
  );
}
