import React, { useEffect, useRef, useState } from "react";
import {
  BoxData,
  ContextExplorerDatasets,
  ContextNameInfo,
  ContextNode,
  ContextPlotBoxData,
  SubtypeBranchBoxPlotData,
} from "src/contextExplorer/models/types";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
  COMPOUND_BOX_PLOT_X_AXIS_TITLE,
  GENE_BOX_PLOT_X_AXIS_TITLE,
} from "src/contextExplorer/utils";
import { DepmapApi } from "src/dAPI";
import BoxPlot, { BoxPlotInfo } from "src/plot/components/BoxPlot";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

const InsignificantColor = { r: 255, g: 255, b: 255 };

interface Props {
  color: { r: number; g: number; b: number; a?: number };
  dapi: DepmapApi;
  urlPrefix: string;
  treeType: string;
  datasetName: ContextExplorerDatasets;
  entityType: string;
  entityFullLabel: string;
  fdr: number[];
  absEffectSize: number[];
  fracDepIn: number[];
  levelZeroCode: string;
  dottedLinePosition: number;
  isLazy?: boolean;
  childrenPlotData?: SubtypeBranchBoxPlotData; // If not provided, lazy load.
  onLoad?: (plot: ExtendedPlotType) => void;
  setXAxisRange?: (range: any[]) => void;
  plotHeight?: number;
  xAxisRange?: any[];
  xAxisTitle?: string;
  bottomMargin?: number;
  topMargin?: number;
}

function BranchBoxPlots({
  dottedLinePosition,
  dapi,
  treeType,
  datasetName,
  fdr,
  absEffectSize,
  fracDepIn,
  levelZeroCode,
  entityType,
  entityFullLabel,
  urlPrefix,
  color,
  xAxisTitle = "",
  xAxisRange = undefined,
  bottomMargin = undefined,
  topMargin = undefined,
  isLazy = false,
  childrenPlotData = undefined,
  setXAxisRange = undefined,
}: Props) {
  const X_AXIS_TITLE =
    entityType === "gene"
      ? GENE_BOX_PLOT_X_AXIS_TITLE
      : COMPOUND_BOX_PLOT_X_AXIS_TITLE;

  // API call to get the data under this level_0. Cache this!!!
  const [boxPlotData, setBoxPlotData] = useState<BoxPlotInfo[]>([]);
  const [isLoadingBranchPlots, setIsLoadingBranchPlots] = useState<boolean>(
    false
  );
  const boxplotLatestPromise = useRef<Promise<SubtypeBranchBoxPlotData> | null>(
    null
  );

  useEffect(() => {
    if (isLazy) {
      setBoxPlotData([]);
      setIsLoadingBranchPlots(true);
      const boxplotPromise = dapi.getSubtypeBranchBoxPlotData(
        levelZeroCode,
        treeType,
        datasetName,
        entityType,
        entityFullLabel,
        fdr,
        absEffectSize,
        fracDepIn
      );
      boxplotLatestPromise.current = boxplotPromise;

      boxplotPromise
        .then((branchPlotData) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            if (
              branchPlotData &&
              branchPlotData.significant_box_plot_data &&
              Object.keys(branchPlotData.significant_box_plot_data).length > 0
            ) {
              const plotInfo: BoxPlotInfo[] = [];
              Object.keys(branchPlotData.significant_box_plot_data).forEach(
                (plotTitle, index) => {
                  const plotData =
                    branchPlotData.significant_box_plot_data[plotTitle];
                  if (plotData.data.length > 0) {
                    plotInfo.push({
                      name: plotData.label,
                      hoverLabels: plotData.cell_line_display_names,
                      xVals: plotData.data,
                      color: {
                        r: color.r,
                        g: color.g,
                        b: color.b,
                        a: 1 / (index + 0.3),
                      },
                      lineColor: "#000000",
                    });
                  }
                }
              );

              const insigPlotData = branchPlotData.insignificant_box_plot_data;
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

              if (plotInfo.length > 0) {
                plotInfo.reverse();
                setBoxPlotData(plotInfo);
              }
            }
          }
        })
        .catch((e) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            window.console.error(e);
            //setBoxplotError(true);
            setIsLoadingBranchPlots(false);
          }
        })
        .finally(() => setIsLoadingBranchPlots(false));
    }
  }, [
    absEffectSize,
    childrenPlotData,
    dapi,
    datasetName,
    entityFullLabel,
    entityType,
    fdr,
    fracDepIn,
    isLazy,
    levelZeroCode,
    treeType,
  ]);

  return (
    <>
      <div>
        {isLoadingBranchPlots && <PlotSpinner />}
        {boxPlotData?.length > 0 && !isLoadingBranchPlots && (
          <BoxPlot
            plotName={`${levelZeroCode} box plot`}
            boxData={boxPlotData}
            onLoad={() => {}}
            setXAxisRange={setXAxisRange}
            xAxisRange={xAxisRange}
            plotHeight={
              boxPlotData.length * BOX_THICKNESS +
              BOX_PLOT_TOP_MARGIN +
              BOX_PLOT_BOTTOM_MARGIN
            }
            xAxisTitle={""}
            bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
            topMargin={BOX_PLOT_TOP_MARGIN}
            dottedLinePosition={dottedLinePosition}
          />
        )}
        {boxPlotData?.length === 0 && !isLoadingBranchPlots && (
          <div>
            <h4>No significant sub-contexts</h4>
          </div>
        )}
      </div>
    </>
  );
}

export default React.memo(BranchBoxPlots);
