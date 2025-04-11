import React, { useEffect, useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import {
  BoxPlotInfo,
  ContextNameInfo,
  ContextPlotBoxData,
  OtherSignificantBoxCardData as OtherSigBoxCardData,
} from "src/contextExplorer/models/types";
import { OtherSolidAndHemeBoxPlots } from "./OtherSolidAndHemeBoxPlotCard";
import { SelectedContextBoxPlotPanel } from "./SelectedContextBoxPlotPanel";
import { SignificantBoxPlotCardPanel } from "./SignificantBoxPlotCardPanel";
import {
  EntityBoxColorList,
  formatSignificantBoxPlotDataCards,
  InsignificantColor,
} from "./utils";

interface Props {
  handleSetMainPlotElement: (element: any) => void;
  topContextNameInfo: ContextNameInfo | null;
  selectedCode: string | undefined;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
  urlPrefix?: string;
  tab?: string;
}

function CollapsibleBoxPlots({
  handleSetMainPlotElement,
  topContextNameInfo,
  selectedCode,
  boxPlotData,
  entityType,
  urlPrefix = undefined,
  tab = undefined,
}: Props) {
  const [
    selectedLevelZeroBoxData,
    setSelectedLevelZeroBoxData,
  ] = useState<BoxPlotInfo | null>(null);
  const [selectedContextBoxData, setSelectedContextBoxData] = useState<
    BoxPlotInfo[] | null
  >(null);

  const [otherSigBoxData, setOtherSigBoxData] = useState<OtherSigBoxCardData[]>(
    []
  );

  const [otherBoxData, setOtherBoxData] = useState<BoxPlotInfo[]>([]);
  const [xAxisRange, setXAxisRange] = useState<any>(null);

  const drugDottedLine = boxPlotData?.drug_dotted_line;

  useEffect(() => {
    if (boxPlotData) {
      const plotInfo: BoxPlotInfo[] = [];
      let boxCardCount = 0;

      boxPlotData.significant_selection?.forEach((plotData) => {
        if (plotData.data.length > 0) {
          if (
            plotData.path.length === 1 &&
            plotData.path[0] === topContextNameInfo?.subtype_code
          ) {
            setSelectedLevelZeroBoxData({
              name: plotData.label,
              hoverLabels: plotData.cell_line_display_names,
              xVals: plotData.data,
              color: { ...EntityBoxColorList[boxCardCount], a: 0.4 },
              lineColor: "#000000",
            });
          } else {
            const info = {
              name: plotData.path!.join("/"),
              hoverLabels: plotData.cell_line_display_names,
              xVals: plotData.data,
              color: {
                ...EntityBoxColorList[boxCardCount],
                a: 0.4,
              },
              lineColor: "#000000",
            };
            plotInfo.push(info);
          }
        }
      });
      boxCardCount += 1;

      const insigPlotData = boxPlotData.insignificant_selection;
      let otherPlot;
      if (
        insigPlotData &&
        insigPlotData.data &&
        insigPlotData.data.length > 0
      ) {
        otherPlot = {
          name: insigPlotData.label,
          hoverLabels: insigPlotData.cell_line_display_names,
          xVals: insigPlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        };
      }

      if (boxPlotData.other_cards) {
        const otherBoxCards = formatSignificantBoxPlotDataCards(
          boxPlotData,
          boxCardCount
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
        if (otherPlot) {
          plotInfo.unshift(otherPlot);
        }
        setSelectedContextBoxData(plotInfo);
      } else if (otherPlot) {
        // Rarely will be hit. This is an edge case.
        setSelectedContextBoxData([otherPlot]);
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
      {topContextNameInfo && (
        <SelectedContextBoxPlotPanel
          activeKey={activeKey}
          topContextNameInfo={topContextNameInfo}
          selectedLevelZeroBoxData={selectedLevelZeroBoxData}
          selectedCode={selectedCode}
          selectedContextBoxData={selectedContextBoxData}
          handleSetMainPlotElement={handleSetMainPlotElement}
          setXAxisRange={setXAxisRange}
          xAxisRange={xAxisRange}
          entityType={entityType}
          urlPrefix={urlPrefix}
          tab={tab}
          drugDottedLine={drugDottedLine}
        />
      )}
      <>
        {otherSigBoxData?.map((otherCard: OtherSigBoxCardData) =>
          Object.keys(otherCard).map((level0Code) => (
            <>
              <Panel
                eventKey={level0Code}
                key={`otherSigLevelZeroBoxData${level0Code}`}
              >
                <SignificantBoxPlotCardPanel
                  selectedCode={selectedCode}
                  activeKey={activeKey}
                  level0Code={level0Code}
                  setXAxisRange={setXAxisRange}
                  xAxisRange={xAxisRange}
                  card={otherCard}
                  entityType={entityType}
                  drugDottedLine={drugDottedLine}
                  urlPrefix={urlPrefix}
                  tab={tab}
                />
              </Panel>
            </>
          ))
        )}
        <OtherSolidAndHemeBoxPlots
          otherBoxData={otherBoxData}
          setXAxisRange={setXAxisRange}
          xAxisRange={xAxisRange}
          entityType={entityType}
          drugDottedLine={drugDottedLine}
        />
      </>
    </PanelGroup>
  );
}

export default React.memo(CollapsibleBoxPlots);
