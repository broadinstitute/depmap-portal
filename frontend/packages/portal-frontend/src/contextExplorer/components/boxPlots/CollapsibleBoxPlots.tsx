import React, { useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup } from "react-bootstrap";
import {
  BoxCardData,
  BoxData,
  ContextNameInfo,
  ContextPlotBoxData,
  ContextExplorerDatasets,
} from "@depmap/types";
import {
  BoxPlotInfo,
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
  featureType: string;
  datasetId: ContextExplorerDatasets;
  urlPrefix?: string;
  tab?: string;
}

function CollapsibleBoxPlots({
  handleSetMainPlotElement,
  topContextNameInfo,
  selectedCode,
  boxPlotData,
  featureType,
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
    featureType === "gene"
      ? GeneEntityBoxColorList
      : CompoundEntityBoxColorList;

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
    if (
      datasetId === ContextExplorerDatasets.PRISMOncologyReferenceLog2AUCMatrix
    ) {
      return boxPlotData?.dataset_units || "";
    }

    if (datasetId === ContextExplorerDatasets.Rep_all_single_pt) {
      return "log2(Viability)";
    }

    return "Gene Effect";
  }, [datasetId, boxPlotData]);

  const xAxisRange = useMemo(() => {
    const sigSelectedData =
      boxPlotData?.significant_selection?.flatMap(
        (boxData: BoxData) => boxData.data
      ) || [];

    const insigSelectedData = boxPlotData?.insignificant_selection?.data || [];

    const sigOtherDataCollections =
      boxPlotData?.other_cards?.map((card: BoxCardData) =>
        card.significant.map((boxData: BoxData) => boxData.data)
      ) || [];
    const sigOtherData = sigOtherDataCollections.flatMap((val: number[][]) =>
      val.flatMap((arr: number[]) => arr)
    );

    const otherData = otherBoxData.flatMap((box: BoxPlotInfo) => box.xVals);

    const allDataSolidHeme = [...otherData];

    const allData = [
      ...sigSelectedData,
      ...insigSelectedData,
      ...sigOtherData,
      ...allDataSolidHeme,
    ];

    const max = Math.max(...allData) + 0.05;
    const min = Math.min(...allData) - 0.05;

    return [min, max];
  }, [boxPlotData, otherBoxData]);

  // HACK: so that Plotly will resize the plot when the user switches to this tab.
  // Without this hack, if the plot loads while this tab is inactive, Plotly does not
  // properly calculate plot size, and this can cause the plot to drastically overflow its bounds.
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    const handler = () => setKey((k) => k + 1);
    window.addEventListener("changeTab:overview", handler);
    return () => window.removeEventListener("changeTab:overview", handler);
  }, []);

  return (
    <PanelGroup
      key={key}
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
          entityType={featureType}
          urlPrefix={urlPrefix}
          tab={tab}
          drugDottedLine={drugDottedLine}
          xAxisTitle={xAxisTitle}
        />
      )}
      <>
        {otherSigBoxData?.map((otherCard: OtherSigBoxCardData) =>
          Object.keys(otherCard)
            .filter((level0Code) => {
              return (
                otherCard[level0Code].levelZeroPlotInfo !== undefined &&
                otherCard[level0Code].subContextInfo.length > 0
              );
            })
            .map((level0Code) => (
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
                  entityType={featureType}
                  drugDottedLine={drugDottedLine}
                  urlPrefix={urlPrefix}
                  tab={tab}
                  xAxisTitle={xAxisTitle}
                />
              </Panel>
            ))
        )}
        <OtherSolidAndHemeBoxPlots
          otherBoxData={otherBoxData}
          xAxisRange={xAxisRange}
          entityType={featureType}
          drugDottedLine={drugDottedLine}
          xAxisTitle={xAxisTitle}
        />
      </>
    </PanelGroup>
  );
}

export default React.memo(CollapsibleBoxPlots);
