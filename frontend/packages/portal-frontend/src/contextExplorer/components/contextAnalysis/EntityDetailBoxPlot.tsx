import React, { useEffect, useState } from "react";
import {
  ContextNameInfo,
  ContextNode,
  ContextPlotBoxData,
} from "src/contextExplorer/models/types";
import {
  COMPOUND_BOX_PLOT_X_AXIS_TITLE,
  GENE_BOX_PLOT_X_AXIS_TITLE,
} from "src/contextExplorer/utils";
import BoxPlot, { BoxPlotInfo } from "src/plot/components/BoxPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

interface Props {
  selectedContextNode: ContextNode;
  topContextNameInfo: ContextNameInfo;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
  handleSetPlotElement: (element: any) => void;
  mainPlot: ExtendedPlotType | null;
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

const InsignificantColor = { r: 255, g: 255, b: 255 };

function EntityDetailBoxPlot({
  topContextNameInfo,
  boxPlotData,
  entityType,
  handleSetPlotElement,
  mainPlot,
}: Props) {
  const [selectedContextBoxData, setSelectedContextBoxData] = useState<
    BoxPlotInfo[] | null
  >(null);
  const [otherBoxData, setOtherBoxData] = useState<BoxPlotInfo[]>([]);

  const [xAxisRange, setXAxisRange] = useState<any>(null);

  const X_AXIS_TITLE =
    entityType === "gene"
      ? GENE_BOX_PLOT_X_AXIS_TITLE
      : COMPOUND_BOX_PLOT_X_AXIS_TITLE;

  const drugDottedLine = boxPlotData?.drug_dotted_line;

  useEffect(() => {
    if (boxPlotData) {
      const plotInfo: BoxPlotInfo[] = [];
      Object.keys(boxPlotData.significant_selection).forEach(
        (plotTitle, index) => {
          const plotData = boxPlotData.significant_selection[plotTitle];
          if (plotData.data.length > 0) {
            plotInfo.push({
              name: plotData.label,
              hoverLabels: plotData.cell_line_display_names,
              xVals: plotData.data,
              color: EntityBoxColorList[index],
              lineColor: "#000000",
            });
          }
        }
      );

      const insigPlotData = boxPlotData.insignifcant_selection;
      if (insigPlotData.data.length > 0) {
        plotInfo.push({
          name: insigPlotData.label,
          hoverLabels: insigPlotData.cell_line_display_names,
          xVals: insigPlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        });
      }

      const hemePlotData = boxPlotData.insignificant_heme_data;
      const otherData = [];
      if (hemePlotData.data.length > 0) {
        otherData.push({
          name: hemePlotData.label,
          hoverLabels: hemePlotData.cell_line_display_names,
          xVals: hemePlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        });
      }

      const solidPlotData = boxPlotData.insignificant_solid_data;
      if (solidPlotData.data.length > 0) {
        otherData.push({
          name: solidPlotData.label,
          hoverLabels: solidPlotData.cell_line_display_names,
          xVals: solidPlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        });
      }

      setOtherBoxData(otherData);

      if (plotInfo.length > 0) {
        plotInfo.reverse();
        setSelectedContextBoxData(plotInfo);
      }
    }
  }, [boxPlotData, topContextNameInfo]);

  return (
    <>
      <div>
        {selectedContextBoxData && (
          <BoxPlot
            plotName="main"
            boxData={selectedContextBoxData}
            onLoad={handleSetPlotElement}
            setXAxisRange={setXAxisRange}
            xAxisRange={xAxisRange}
            plotHeight={selectedContextBoxData.length * 90 + 80}
            xAxisTitle={X_AXIS_TITLE}
            bottomMargin={80}
            topMargin={100}
            dottedLinePosition={
              entityType === "gene" ? -1 : drugDottedLine || -1.74
            }
          />
        )}
      </div>
      <div style={{ marginTop: "100px" }}>
        {otherBoxData.length > 0 && (
          <BoxPlot
            plotName="other solid and heme"
            boxData={otherBoxData}
            onLoad={handleSetPlotElement}
            setXAxisRange={setXAxisRange}
            xAxisRange={xAxisRange}
            plotHeight={2 * 105 + 80}
            xAxisTitle={X_AXIS_TITLE}
            bottomMargin={80}
            topMargin={100}
            dottedLinePosition={
              entityType === "gene" ? -1 : drugDottedLine || -1.74
            }
          />
        )}
      </div>
    </>
  );
}

export default React.memo(EntityDetailBoxPlot);
