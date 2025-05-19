import React, { useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import {
  BoxCardData,
  BoxData,
  BoxPlotInfo,
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextPlotBoxData,
  OtherSignificantBoxCardData as OtherSigBoxCardData,
} from "src/contextExplorer/models/types";
import { OtherSolidAndHemeBoxPlots } from "./OtherSolidAndHemeBoxPlotCard";
import { SelectedContextBoxPlotPanel } from "./SelectedContextBoxPlotPanel";
import { SignificantBoxPlotCardPanel } from "./SignificantBoxPlotCardPanel";
import {
  GeneEntityBoxColorList,
  CompoundEntityBoxColorList,
  formatSignificantBoxPlotDataCards,
  InsignificantColor,
} from "./utils";

interface Props {
  handleSetMainPlotElement: (element: any) => void;
  topContextNameInfo: ContextNameInfo | null;
  selectedCode: string | undefined;
  boxPlotData: ContextPlotBoxData | null;
  entityType: string;
  datasetId: ContextExplorerDatasets;
  urlPrefix?: string;
  tab?: string;
}

function CollapsibleBoxPlots({
  handleSetMainPlotElement,
  topContextNameInfo,
  selectedCode,
  boxPlotData,
  entityType,
  datasetId,
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

  const drugDottedLine = boxPlotData?.drug_dotted_line;
  const EntityBoxColorList =
    entityType === "gene" ? GeneEntityBoxColorList : CompoundEntityBoxColorList;

  useEffect(() => {
    if (boxPlotData) {
      const plotInfo: BoxPlotInfo[] = [];

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
              color: { ...EntityBoxColorList[0], a: 0.4 },
              lineColor: "#000000",
            });
          } else {
            const info = {
              name: plotData.path!.join("/"),
              hoverLabels: plotData.cell_line_display_names,
              xVals: plotData.data,
              color: {
                ...EntityBoxColorList[0],
                a: 0.4,
              },
              lineColor: "#000000",
            };
            plotInfo.push(info);
          }
        }
      });
      const boxCardCount = 1;

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
          boxCardCount,
          EntityBoxColorList
        );

        setOtherSigBoxData(otherBoxCards);
      }

      const hemePlotData = boxPlotData.insignificant_heme_data;
      const solidPlotData = boxPlotData.insignificant_solid_data;

      const otherData = [];
      if (hemePlotData.data.length > 0) {
        otherData.push({
          name:
            hemePlotData.data.length === 0 || solidPlotData.data.length === 0
              ? "Other"
              : hemePlotData.label,
          hoverLabels: hemePlotData.cell_line_display_names,
          xVals: hemePlotData.data,
          color: InsignificantColor,
          lineColor: "#000000",
          pointLineColor: "#000000",
        });
      }

      if (solidPlotData.data.length > 0) {
        otherData.push({
          name: hemePlotData.data.length === 0 ? "Other" : solidPlotData.label,
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
        setSelectedContextBoxData([otherPlot]);
      }
    }
  }, [boxPlotData, topContextNameInfo, EntityBoxColorList]);

  const [activeKey, setActiveKey] = useState<string | null>("SELECTED");
  const handleAccordionClick = (index: string) => {
    setActiveKey((prevIndex) => (prevIndex === index ? null : index));
  };

  const xAxisTitle = useMemo(() => {
    if (datasetId === ContextExplorerDatasets.Prism_oncology_AUC) {
      return "AUC";
    }

    if (datasetId === ContextExplorerDatasets.Rep_all_single_pt) {
      return "log2(Viability)";
    }

    return "Gene Effect";
  }, [datasetId]);

  const xAxisRange = useMemo(() => {
    if (
      boxPlotData?.significant_selection?.length === 0 &&
      boxPlotData.other_cards.length === 0 &&
      otherBoxData.length > 0
    ) {
      const otherData = otherBoxData.flatMap((box: BoxPlotInfo) => box.xVals);

      const allDataSolidHeme = [...otherData];

      const maxSolidHeme = Math.max(...allDataSolidHeme) + 0.05;
      const minSolidHeme = Math.min(...allDataSolidHeme) - 0.05;

      return [minSolidHeme, maxSolidHeme];
    }
    const sigSelectedData =
      boxPlotData?.significant_selection?.flatMap(
        (boxData: BoxData) => boxData.data
      ) || [];

    const sigOtherDataCollections =
      boxPlotData?.other_cards?.map((card: BoxCardData) =>
        card.significant.map((boxData: BoxData) => boxData.data)
      ) || [];
    const sigOtherData = sigOtherDataCollections.flatMap((val: number[][]) =>
      val.flatMap((arr: number[]) => arr)
    );

    const allData = [...sigSelectedData, ...sigOtherData];

    const max = Math.max(...allData) + 0.05;
    const min = Math.min(...allData) - 0.05;

    return [min, max];
  }, [boxPlotData, otherBoxData]);

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
          xAxisRange={xAxisRange}
          entityType={entityType}
          urlPrefix={urlPrefix}
          tab={tab}
          drugDottedLine={drugDottedLine}
          xAxisTitle={xAxisTitle}
        />
      )}
      <>
        {otherSigBoxData?.map((otherCard: OtherSigBoxCardData) =>
          Object.keys(otherCard).map((level0Code) => (
            <>
              {otherCard[level0Code].levelZeroPlotInfo !== undefined &&
                otherCard[level0Code].subContextInfo.length > 0 && (
                  <Panel
                    eventKey={level0Code}
                    key={`otherSigLevelZeroBoxData${level0Code}`}
                  >
                    <SignificantBoxPlotCardPanel
                      selectedCode={selectedCode}
                      activeKey={activeKey}
                      level0Code={level0Code}
                      xAxisRange={xAxisRange}
                      card={otherCard}
                      entityType={entityType}
                      drugDottedLine={drugDottedLine}
                      urlPrefix={urlPrefix}
                      tab={tab}
                      xAxisTitle={xAxisTitle}
                    />
                  </Panel>
                )}
            </>
          ))
        )}
        <OtherSolidAndHemeBoxPlots
          otherBoxData={otherBoxData}
          xAxisRange={xAxisRange}
          entityType={entityType}
          drugDottedLine={drugDottedLine}
          xAxisTitle={xAxisTitle}
        />
      </>
    </PanelGroup>
  );
}

export default React.memo(CollapsibleBoxPlots);
