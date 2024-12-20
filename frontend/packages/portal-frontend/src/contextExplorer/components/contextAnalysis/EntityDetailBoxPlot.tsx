import React, { useEffect, useState } from "react";
import { Checkbox } from "react-bootstrap";
import {
  ContextNameInfo,
  ContextPlotBoxData,
} from "src/contextExplorer/models/types";
import {
  COMPOUND_BOX_PLOT_X_AXIS_TITLE,
  GENE_BOX_PLOT_X_AXIS_TITLE,
} from "src/contextExplorer/utils";
import BoxPlot, { BoxPlotInfo } from "src/plot/components/BoxPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  selectedContextNameInfo: ContextNameInfo;
  topContextNameInfo: ContextNameInfo;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
  handleSetPlotElement: (element: any) => void;
  mainPlot: ExtendedPlotType | null;
  showOtherContexts: boolean;
  handleShowOtherContexts: () => void;
}

const EntityBoxColorList = [
  { r: 0, g: 109, b: 91 },
  { r: 0, g: 109, b: 91 },
  { r: 233, g: 116, b: 81 },
  { r: 53, g: 15, b: 138 },
  { r: 170, g: 51, b: 106 },
  { r: 139, g: 0, b: 0 },
  { r: 254, g: 52, b: 126 },
  { r: 0, g: 100, b: 0 },
  { r: 138, g: 154, b: 91 },
  { r: 152, g: 251, b: 152 },
  { r: 138, g: 43, b: 226 },
  { r: 0, g: 191, b: 255 },
];

function EntityDetailBoxPlot({
  selectedContextNameInfo,
  topContextNameInfo,
  boxPlotData,
  entityType,
  handleSetPlotElement,
  mainPlot,
  showOtherContexts,
  handleShowOtherContexts,
}: Props) {
  const [boxData, setBoxData] = useState<BoxPlotInfo[] | null>(null);
  const [otherBoxData, setOtherBoxData] = useState<BoxPlotInfo[] | null>(null);
  const [xAxisRange, setXAxisRange] = useState<any>(null);

  const X_AXIS_TITLE =
    entityType === "gene"
      ? GENE_BOX_PLOT_X_AXIS_TITLE
      : COMPOUND_BOX_PLOT_X_AXIS_TITLE;

  const drugDottedLine = boxPlotData?.drug_dotted_line;

  useEffect(() => {
    if (boxPlotData) {
      const plotInfo: BoxPlotInfo[] = [];
      const otherContextDepsInfo: BoxPlotInfo[] = [];
      boxPlotData.box_plot_data.forEach((plotData, index) => {
        if (plotData.data.length > 0) {
          plotInfo.push({
            name: plotData.label,
            hoverLabels: plotData.cell_line_display_names,
            xVals: plotData.data,
            color: EntityBoxColorList[index],
            lineColor: "#000000",
          });
        }
      });

      if (plotInfo.length > 0) {
        plotInfo.reverse();
        setBoxData(plotInfo);
      }
    }
  }, [boxPlotData, selectedContextNameInfo, topContextNameInfo]);

  return (
    <div>
      {boxData && (
        <BoxPlot
          plotName="main"
          boxData={boxData}
          onLoad={handleSetPlotElement}
          setXAxisRange={setXAxisRange}
          xAxisRange={xAxisRange}
          plotHeight={boxData.length * 95 + 80}
          xAxisTitle={X_AXIS_TITLE}
          bottomMargin={80}
          topMargin={100}
          dottedLinePosition={
            entityType === "gene" ? -1 : drugDottedLine || -1.74
          }
        />
      )}
      <Checkbox
        checked={showOtherContexts}
        disabled={!otherBoxData}
        onChange={handleShowOtherContexts}
      >
        {otherBoxData && otherBoxData.length > 0 && mainPlot ? (
          <p>
            {entityType === "gene"
              ? "Show other disease contexts where gene is a selective dependency"
              : "Show other disease contexts where drug is a selective sensitivity"}
          </p>
        ) : (
          <p>
            {entityType} is not a selective{" "}
            {entityType === "gene" ? "dependency" : "sensitivity"} in other
            contexts
          </p>
        )}{" "}
      </Checkbox>
      {otherBoxData && showOtherContexts && mainPlot && (
        <BoxPlot
          plotName="other"
          boxData={otherBoxData}
          plotHeight={otherBoxData.length * 95 + 80}
          xAxisRange={xAxisRange}
          xAxisTitle={
            entityType === "gene"
              ? GENE_BOX_PLOT_X_AXIS_TITLE
              : COMPOUND_BOX_PLOT_X_AXIS_TITLE
          }
          bottomMargin={80}
          dottedLinePosition={
            entityType === "gene" ? -1 : drugDottedLine || -1.74
          }
        />
      )}
    </div>
  );
}

export default React.memo(EntityDetailBoxPlot);
