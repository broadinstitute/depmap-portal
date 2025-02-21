import React, { useEffect, useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import {
  BoxCardData,
  BoxData,
  ContextNameInfo,
  ContextPlotBoxData,
  OtherBoxCardData,
} from "src/contextExplorer/models/types";
// import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
} from "src/contextExplorer/utils";
import BoxPlot, { BoxPlotInfo } from "src/plot/components/BoxPlot";

const EntityBoxColorList = [
  { r: 53, g: 15, b: 138 },
  { r: 170, g: 51, b: 106 },
  { r: 0, g: 109, b: 91 },
  { r: 233, g: 116, b: 81 },
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
  selectedCode: string;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
}

function CollapsibleBoxPlots({
  handleSetMainPlotElement,
  topContextNameInfo,
  selectedCode,
  boxPlotData,
  entityType,
}: Props) {
  const [
    selectedLevelZeroBoxData,
    setSelectedLevelZeroBoxData,
  ] = useState<BoxPlotInfo | null>(null);
  const [selectedContextBoxData, setSelectedContextBoxData] = useState<
    BoxPlotInfo[] | null
  >(null);

  const [otherSigBoxData, setOtherSigBoxData] = useState<OtherBoxCardData[]>(
    []
  );

  const [otherBoxData, setOtherBoxData] = useState<BoxPlotInfo[]>([]);
  const [xAxisRange, setXAxisRange] = useState<any>(null);

  const X_AXIS_TITLE = "";
  // entityType === "gene"
  //   ? GENE_BOX_PLOT_X_AXIS_TITLE
  //   : COMPOUND_BOX_PLOT_X_AXIS_TITLE;

  const drugDottedLine = boxPlotData?.drug_dotted_line;

  const formatBoxData = (
    boxData: { [key: string]: BoxData },
    insigBoxData: BoxData,
    levelZeroCode: string,
    count: number
  ) => {
    const formattedBoxData: BoxPlotInfo[] = [];
    const codes = Object.keys(boxData);
    for (let index = 0; index < codes.length; index++) {
      const code = codes[index];
      const box = boxData[code];

      if (code !== levelZeroCode) {
        const info = {
          name: box.path!.join("/"),
          hoverLabels: box.cell_line_display_names,
          xVals: box.data,
          color: {
            ...EntityBoxColorList[count],
            a: 1 / (index + 0.3),
          },
          lineColor: "#000000",
        };
        formattedBoxData.push(info);
      }
    }

    if (insigBoxData?.data && insigBoxData.data.length > 0) {
      formattedBoxData.push({
        name: insigBoxData.label,
        hoverLabels: insigBoxData.cell_line_display_names,
        xVals: insigBoxData.data,
        color: InsignificantColor,
        lineColor: "#000000",
        pointLineColor: "#000000",
      });
    }

    return formattedBoxData;
  };

  useEffect(() => {
    if (
      boxPlotData &&
      boxPlotData.significant_selection &&
      Object.keys(boxPlotData.significant_selection).length > 0
    ) {
      const plotInfo: BoxPlotInfo[] = [];
      let boxCardCount = 0;

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
                color: { ...EntityBoxColorList[boxCardCount], a: 0.7 },
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
                color: {
                  ...EntityBoxColorList[boxCardCount],
                  a: 1 / (index + 0.3),
                },
                lineColor: "#000000",
              };
              plotInfo.push(info);
            }
          }
        }
      );
      boxCardCount += 1;

      const insigPlotData = boxPlotData.insignifcant_selection;
      if (insigPlotData.data && insigPlotData.data.length > 0) {
        plotInfo.push({
          name: insigPlotData.label,
          hoverLabels: insigPlotData.cell_line_display_names,
          xVals: insigPlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        });
      }

      if (boxPlotData.other_cards) {
        const otherBoxCards = boxPlotData.other_cards.map(
          (cardData: BoxCardData) => {
            boxCardCount += 1;
            const level0Data = cardData.significant[cardData.level_0_code];
            return {
              [cardData.level_0_code]: {
                levelZeroPlotInfo: {
                  name: level0Data.label,
                  hoverLabels: level0Data.cell_line_display_names,
                  xVals: level0Data.data,
                  color: { ...EntityBoxColorList[boxCardCount], a: 0.7 },
                  lineColor: "#000000",
                },
                subContextInfo: formatBoxData(
                  cardData.significant,
                  cardData.insignifcant,
                  cardData.level_0_code,
                  boxCardCount
                ),
              },
            };
          }
        );

        setOtherSigBoxData(otherBoxCards);
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
          {selectedLevelZeroBoxData && selectedContextBoxData === null ? (
            <Panel.Title>
              {" "}
              <BoxPlot
                plotName="main-header"
                boxData={[selectedLevelZeroBoxData]}
                setXAxisRange={setXAxisRange}
                onLoad={handleSetMainPlotElement}
                xAxisRange={xAxisRange}
                selectedCode={selectedCode}
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
            </Panel.Title>
          ) : (
            <Panel.Title toggle>
              {" "}
              <div style={{ display: "flex", flexDirection: "row" }}>
                {selectedLevelZeroBoxData &&
                  selectedContextBoxData &&
                  selectedContextBoxData.length > 0 && (
                    <span
                      style={{
                        paddingRight: "8px",
                        paddingTop: activeKey === "SELECTED" ? "0px" : "12px",
                        fontSize: "12px",
                        color: "#4479B2",
                      }}
                      className={
                        activeKey === "SELECTED"
                          ? "glyphicon glyphicon-chevron-up"
                          : "glyphicon glyphicon-chevron-down"
                      }
                    />
                  )}
                {selectedLevelZeroBoxData && activeKey !== "SELECTED" ? (
                  <BoxPlot
                    plotName="main-header"
                    boxData={[selectedLevelZeroBoxData]}
                    setXAxisRange={setXAxisRange}
                    onLoad={handleSetMainPlotElement}
                    xAxisRange={xAxisRange}
                    selectedCode={selectedCode}
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
                ) : (
                  selectedLevelZeroBoxData &&
                  activeKey === "SELECTED" && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight:
                          selectedCode === selectedLevelZeroBoxData.name
                            ? "600"
                            : "normal",
                        color:
                          selectedCode === selectedLevelZeroBoxData.name
                            ? "#333333"
                            : "#4479B2",
                      }}
                    >
                      {selectedLevelZeroBoxData.name}
                    </span>
                  )
                )}
              </div>
            </Panel.Title>
          )}
        </Panel.Heading>

        {selectedContextBoxData && selectedContextBoxData.length > 0 && (
          <Panel.Body collapsible>
            {" "}
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
                selectedCode={selectedCode}
                dottedLinePosition={
                  entityType === "gene" ? -1 : drugDottedLine || -1.74
                }
              />
            </div>
          </Panel.Body>
        )}
      </Panel>
      <>
        {otherSigBoxData?.map((otherCard: OtherBoxCardData) =>
          Object.keys(otherCard).map((level0Code) => (
            <Panel
              eventKey={level0Code}
              key={`otherSigLevelZeroBoxData${level0Code}`}
            >
              <Panel.Heading>
                <Panel.Title toggle>
                  <div style={{ display: "flex", flexDirection: "row" }}>
                    <span
                      style={{
                        paddingRight: "8px",
                        paddingTop: activeKey === level0Code ? "0px" : "12px",
                        fontSize: "12px",
                        color: "#4479B2",
                      }}
                      className={
                        activeKey === level0Code
                          ? "glyphicon glyphicon-chevron-up"
                          : "glyphicon glyphicon-chevron-down"
                      }
                    />
                    {activeKey !== level0Code ? (
                      <BoxPlot
                        plotName={`${level0Code}-header`}
                        boxData={[otherCard[level0Code].levelZeroPlotInfo]}
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
                    ) : (
                      activeKey === level0Code && (
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight:
                              selectedCode === level0Code ? "600" : "normal",
                            color:
                              selectedCode === level0Code
                                ? "#333333"
                                : "#4479B2",
                          }}
                        >
                          {level0Code}
                        </span>
                      )
                    )}
                  </div>
                </Panel.Title>
              </Panel.Heading>
              <Panel.Body collapsible>
                {activeKey === level0Code &&
                  otherCard[level0Code].subContextInfo.length > 0 && (
                    <BoxPlot
                      plotName={`${level0Code} box plot`}
                      boxData={otherCard[level0Code].subContextInfo}
                      onLoad={() => {}}
                      setXAxisRange={setXAxisRange}
                      xAxisRange={xAxisRange}
                      plotHeight={
                        otherCard[level0Code].subContextInfo.length *
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
                  )}
              </Panel.Body>
            </Panel>
          ))
        )}
      </>
      <Panel eventKey="OTHER">
        <Panel.Body>
          {" "}
          <div>
            {otherBoxData.length > 0 ? (
              <BoxPlot
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
            ) : (
              <div>
                <h4>No Other Solid or Heme Models Available</h4>
              </div>
            )}
          </div>
        </Panel.Body>
      </Panel>
    </PanelGroup>
  );
}

export default React.memo(CollapsibleBoxPlots);
