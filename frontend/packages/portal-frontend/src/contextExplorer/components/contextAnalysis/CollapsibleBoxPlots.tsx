import React, { useCallback, useEffect, useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import {
  BoxData,
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextNode,
  ContextPlotBoxData,
  TreeType,
} from "src/contextExplorer/models/types";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import { ApiContext } from "@depmap/api";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
  COMPOUND_BOX_PLOT_X_AXIS_TITLE,
  GENE_BOX_PLOT_X_AXIS_TITLE,
} from "src/contextExplorer/utils";
import { DepmapApi } from "src/dAPI";
import BoxPlot, { BoxPlotInfo } from "src/plot/components/BoxPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import BranchBoxPlots from "./BranchBoxPlots";
import { defaultPoints } from "src/compound/components/DoseResponseCurve";
import { fetchUrlPrefix } from "src/common/utilities/context";

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

interface Props {
  handleSetMainPlotElement: (element: any) => void;
  topContextNameInfo: ContextNameInfo;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
  entityFullLabel: string;
  treeType: TreeType;
  datasetName: ContextExplorerDatasets;
  fdr: number[];
  absEffectSize: number[];
  fracDepIn: number[];
  dapi: DepmapApi;
}

function CollapsibleBoxPlots({
  handleSetMainPlotElement,
  topContextNameInfo,
  boxPlotData,
  entityType,
  treeType,
  datasetName,
  entityFullLabel,
  fdr,
  absEffectSize,
  fracDepIn,
  dapi,
}: Props) {
  let relativeUrlPrefix = fetchUrlPrefix();

  if (relativeUrlPrefix === "/") {
    relativeUrlPrefix = "";
  }

  const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;

  // API call to get the data under this level_0. Cache this!!!
  const [
    selectedLevelZeroBoxData,
    setSelectedLevelZeroBoxData,
  ] = useState<BoxPlotInfo | null>(null);
  const [selectedContextBoxData, setSelectedContextBoxData] = useState<
    BoxPlotInfo[] | null
  >(null);
  const [otherSigLevelZeroBoxData, setOtherSigLevelZeroBoxData] = useState<
    BoxPlotInfo[]
  >([]);
  const [otherBoxData, setOtherBoxData] = useState<BoxPlotInfo[]>([]);
  const [xAxisRange, setXAxisRange] = useState<any>(null);

  const X_AXIS_TITLE = "";
  // entityType === "gene"
  //   ? GENE_BOX_PLOT_X_AXIS_TITLE
  //   : COMPOUND_BOX_PLOT_X_AXIS_TITLE;

  const drugDottedLine = boxPlotData?.drug_dotted_line;

  useEffect(() => {
    if (
      boxPlotData &&
      boxPlotData.significant_selection &&
      Object.keys(boxPlotData.significant_selection).length > 0
    ) {
      const plotInfo: BoxPlotInfo[] = [];

      Object.keys(boxPlotData.significant_selection).forEach(
        (plotTitle, index) => {
          if (boxPlotData.significant_selection[plotTitle].data.length > 0) {
            if (plotTitle === topContextNameInfo.subtype_code) {
              setSelectedLevelZeroBoxData({
                name: boxPlotData.significant_selection[plotTitle].label,
                hoverLabels:
                  boxPlotData.significant_selection[plotTitle]
                    .cell_line_display_names,
                xVals: boxPlotData.significant_selection[plotTitle].data,
                color: EntityBoxColorList[index],
                lineColor: "#000000",
              });
            } else {
              const info = {
                name: boxPlotData.significant_selection[plotTitle].path!.join(
                  "/"
                ),
                hoverLabels:
                  boxPlotData.significant_selection[plotTitle]
                    .cell_line_display_names,
                xVals: boxPlotData.significant_selection[plotTitle].data,
                color: EntityBoxColorList[index],
                lineColor: "#000000",
              };
              plotInfo.push(info);
            }
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

      const otherSigLevel0PlotInfo: BoxPlotInfo[] = [];
      if (boxPlotData.significant_other) {
        Object.keys(boxPlotData.significant_other).forEach(
          (plotTitle, index) => {
            const plotData = boxPlotData.significant_other[plotTitle];
            if (plotData.data.length > 0) {
              otherSigLevel0PlotInfo.push({
                name: plotData.label,
                code: plotData.label,
                hoverLabels: plotData.cell_line_display_names,
                xVals: plotData.data,
                color: EntityBoxColorList[index],
                lineColor: "#000000",
              });
            }
          }
        );
      }
      setOtherSigLevelZeroBoxData(otherSigLevel0PlotInfo);

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

  const [activeKey, setActiveKey] = useState<string | null>("SELECTED");
  const handleAccordionClick = (index: string) => {
    setActiveKey((prevIndex) => (prevIndex === index ? null : index));
  };

  return (
    <PanelGroup
      accordion
      id="context-explorer-box-plots"
      activeKey={activeKey}
      onSelect={(index) => handleAccordionClick(index)}
    >
      <Panel eventKey="SELECTED">
        <Panel.Heading>
          <Panel.Title toggle>
            {" "}
            <div style={{ display: "flex", flexDirection: "row" }}>
              <span
                style={{
                  paddingRight: "8px",
                  paddingTop: "12px",
                  fontSize: "12px",
                }}
                className={
                  activeKey === "SELECTED"
                    ? "glyphicon glyphicon-chevron-up"
                    : "glyphicon glyphicon-chevron-down"
                }
              />
              {selectedLevelZeroBoxData && (
                <BoxPlot
                  plotName="main-header"
                  boxData={[selectedLevelZeroBoxData]}
                  setXAxisRange={setXAxisRange}
                  xAxisRange={xAxisRange}
                  plotHeight={
                    BOX_THICKNESS + BOX_PLOT_TOP_MARGIN + BOX_PLOT_BOTTOM_MARGIN
                  }
                  xAxisTitle={""}
                  bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
                  topMargin={BOX_PLOT_TOP_MARGIN}
                  dottedLinePosition={
                    entityType === "gene" ? -1 : drugDottedLine || -1.74
                  }
                />
              )}
            </div>
          </Panel.Title>
        </Panel.Heading>

        <Panel.Body collapsible>
          {" "}
          {selectedContextBoxData && (
            <div>
              <BoxPlot
                plotName="main"
                boxData={selectedContextBoxData}
                onLoad={handleSetMainPlotElement}
                setXAxisRange={setXAxisRange}
                xAxisRange={xAxisRange}
                plotHeight={
                  selectedContextBoxData.length * BOX_THICKNESS +
                  BOX_PLOT_TOP_MARGIN +
                  BOX_PLOT_BOTTOM_MARGIN
                }
                xAxisTitle={X_AXIS_TITLE}
                bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
                topMargin={BOX_PLOT_TOP_MARGIN}
                dottedLinePosition={
                  entityType === "gene" ? -1 : drugDottedLine || -1.74
                }
              />
            </div>
          )}
        </Panel.Body>
      </Panel>
      <>
        {otherSigLevelZeroBoxData?.map((levelOBoxData: BoxPlotInfo) => (
          <Panel
            eventKey={levelOBoxData.name}
            key={`otherSigLevelZeroBoxData${levelOBoxData}`}
          >
            <Panel.Heading>
              <Panel.Title toggle>
                <div style={{ display: "flex", flexDirection: "row" }}>
                  <span
                    style={{
                      paddingRight: "8px",
                      paddingTop: "12px",
                      fontSize: "12px",
                    }}
                    className={
                      activeKey === levelOBoxData.name
                        ? "glyphicon glyphicon-chevron-up"
                        : "glyphicon glyphicon-chevron-down"
                    }
                  />
                  <BoxPlot
                    urlPrefix={urlPrefix}
                    plotName={`${levelOBoxData}-header`}
                    boxData={[levelOBoxData]}
                    setXAxisRange={setXAxisRange}
                    xAxisRange={xAxisRange}
                    plotHeight={
                      BOX_THICKNESS +
                      BOX_PLOT_TOP_MARGIN +
                      BOX_PLOT_BOTTOM_MARGIN
                    }
                    xAxisTitle={""}
                    bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
                    topMargin={BOX_PLOT_TOP_MARGIN}
                    dottedLinePosition={
                      entityType === "gene" ? -1 : drugDottedLine || -1.74
                    }
                  />
                </div>
              </Panel.Title>
            </Panel.Heading>
            <Panel.Body collapsible>
              {activeKey === levelOBoxData.name && (
                <BranchBoxPlots
                  urlPrefix={urlPrefix}
                  dapi={dapi}
                  treeType={treeType}
                  datasetName={datasetName}
                  entityType={entityType}
                  entityFullLabel={entityFullLabel}
                  fdr={fdr}
                  absEffectSize={absEffectSize}
                  levelZeroCode={levelOBoxData.code!}
                  fracDepIn={fracDepIn}
                  dottedLinePosition={
                    entityType === "gene" ? -1 : drugDottedLine || -1.74
                  }
                  isLazy
                />
              )}
            </Panel.Body>
          </Panel>
        ))}
      </>
      <Panel eventKey="OTHER">
        <Panel.Body>
          {" "}
          <div>
            {otherBoxData.length > 0 && (
              <BoxPlot
                urlPrefix={urlPrefix}
                plotName="other solid and heme"
                boxData={otherBoxData}
                setXAxisRange={setXAxisRange}
                xAxisRange={xAxisRange}
                plotHeight={
                  otherBoxData.length * BOX_THICKNESS +
                  BOX_PLOT_TOP_MARGIN +
                  BOX_PLOT_BOTTOM_MARGIN
                }
                xAxisTitle={X_AXIS_TITLE}
                bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
                topMargin={BOX_PLOT_TOP_MARGIN}
                dottedLinePosition={
                  entityType === "gene" ? -1 : drugDottedLine || -1.74
                }
              />
            )}
          </div>
        </Panel.Body>
      </Panel>
    </PanelGroup>
  );
}

export default React.memo(CollapsibleBoxPlots);
