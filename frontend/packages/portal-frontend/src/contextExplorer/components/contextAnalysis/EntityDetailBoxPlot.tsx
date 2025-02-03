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
import { DepmapApi } from "src/dAPI";
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

function EntityDetailBoxPlotPanel({
  selectedContextNode,
  topContextNameInfo,
  boxPlotData,
  entityType,
  handleSetPlotElement,
  mainPlot,
}: Props) {
  const [branchPlotData, setBranchPlotData] = useState<branchPlotData | null>(
    null
  );
  const [isLoadingBranchPlots, setIsLoadingBranchPlots] = useState<boolean>(
    false
  );
  const boxplotLatestPromise = useRef<Promise<SubtypeBranchBoxPlotData> | null>(
    null
  );
  useEffect(() => {
    if (isOpen && !branchPlotData) {
      setBranchPlotData(null);
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
        .then((dataVals) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            setBranchPlotData(dataVals);
          }
        })
        .catch((e) => {
          if (boxplotPromise === boxplotLatestPromise.current) {
            window.console.error(e);
            //setBoxplotError(true);
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

export default React.memo(EntityDetailBoxPlotPanel);
