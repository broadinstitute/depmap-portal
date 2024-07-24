import React, { useEffect, useState } from "react";
import { Checkbox } from "react-bootstrap";
import InfoIcon from "src/common/components/InfoIcon";
import {
  BoxPlotTypes,
  ContextNameInfo,
  ContextPlotBoxData,
} from "src/contextExplorer/models/types";
import {
  BLOOD_LINEAGES,
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
  useScatterPlotFiltersOnBoxPlot: boolean;
  handleUseScatterPlotFiltersClicked: () => void;
  boxPlotFDRRange: number[] | null;
  boxPlotEffectSizeRange: number[] | null;
  boxPlotFracDepInRange: number[] | null;
  showOtherContexts: boolean;
  handleShowOtherContexts: () => void;
  customInfoImg: React.JSX.Element;
}

const EntityBoxColorMap = new Map<
  BoxPlotTypes,
  { r: number; g: number; b: number }
>([
  [BoxPlotTypes.SelectedLineage, { r: 0, g: 109, b: 91 }], // example: Bone
  [BoxPlotTypes.SelectedPrimaryDisease, { r: 0, g: 109, b: 91 }],
  [BoxPlotTypes.SameLineageType, { r: 233, g: 116, b: 81 }], // example: Other Solid
  [BoxPlotTypes.SameLineage, { r: 53, g: 15, b: 138 }],
  [BoxPlotTypes.OtherLineageType, { r: 170, g: 51, b: 106 }],
]);

const OtherColorOptions = [
  { r: 139, g: 0, b: 0 },
  { r: 254, g: 52, b: 126 },
  { r: 0, g: 100, b: 0 },
  { r: 138, g: 154, b: 91 },
  { r: 152, g: 251, b: 152 },
  { r: 138, g: 43, b: 226 },
  { r: 0, g: 191, b: 255 },
];

function getPlotName(
  type: BoxPlotTypes,
  selectedContextNameInfo: ContextNameInfo,
  topContextNameInfo: ContextNameInfo,
  otherDepName: string
) {
  const lineageType =
    BLOOD_LINEAGES.includes(topContextNameInfo.display_name) ||
    BLOOD_LINEAGES.includes(topContextNameInfo.name)
      ? "Heme"
      : "Solid";

  const otherLineageType = lineageType === "Solid" ? "Heme" : "Solid";

  switch (type) {
    case BoxPlotTypes.SelectedLineage:
      return topContextNameInfo.display_name;
    case BoxPlotTypes.SelectedPrimaryDisease:
      return selectedContextNameInfo.display_name;
    case BoxPlotTypes.SameLineage:
      return `Other ${topContextNameInfo.display_name}`;
    case BoxPlotTypes.OtherLineageType:
      return `${otherLineageType}`;
    case BoxPlotTypes.SameLineageType:
      return `Other ${lineageType}`;
    case BoxPlotTypes.Other:
      return otherDepName;
    default:
      throw new Error(`Unrecognized plot type: ${type}`);
  }
}

function EntityDetailBoxPlot({
  selectedContextNameInfo,
  topContextNameInfo,
  boxPlotData,
  entityType,
  handleSetPlotElement,
  mainPlot,
  useScatterPlotFiltersOnBoxPlot,
  handleUseScatterPlotFiltersClicked,
  boxPlotFDRRange,
  boxPlotEffectSizeRange,
  boxPlotFracDepInRange,
  showOtherContexts,
  handleShowOtherContexts,
  customInfoImg,
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
      boxPlotData.box_plot_data.forEach((plotData) => {
        if (plotData.data.length > 0) {
          plotInfo.push({
            name: getPlotName(
              plotData.type,
              selectedContextNameInfo,
              topContextNameInfo,
              ""
            ),
            hoverLabels: plotData.cell_line_display_names,
            vals: plotData.data,
            color: EntityBoxColorMap.get(plotData.type) ?? {
              r: 170,
              g: 51,
              b: 106,
            },
            lineColor: "#000000",
          });
        }
      });
      let otherColorIndex = 0;
      boxPlotData.other_context_dependencies.forEach((plotData) => {
        if (plotData.data.length > 0) {
          otherContextDepsInfo.push({
            name: getPlotName(
              plotData.type,
              selectedContextNameInfo,
              topContextNameInfo,
              plotData.name
            ),
            hoverLabels: plotData.cell_line_display_names,
            vals: plotData.data,
            color: OtherColorOptions[otherColorIndex],
            lineColor: "#000000",
          });

          otherColorIndex += 1;
          if (otherColorIndex > OtherColorOptions.length - 1) {
            otherColorIndex = 0;
          }
        }
      });

      if (plotInfo.length > 0) {
        plotInfo.reverse();
        setBoxData(plotInfo);
      }

      if (otherContextDepsInfo.length > 0) {
        setOtherBoxData(otherContextDepsInfo);
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
        )}
      </Checkbox>
      {mainPlot && (
        <>
          <Checkbox
            checked={useScatterPlotFiltersOnBoxPlot}
            style={{ marginBottom: "0" }}
            onChange={handleUseScatterPlotFiltersClicked}
          >
            <span>
              Apply Scatter Plot Filters
              <InfoIcon
                target={customInfoImg}
                popoverContent={
                  <p>
                    To identify other contexts in which your{" "}
                    {entityType === "gene" ? "gene" : "drug"} of interest is a
                    selective{" "}
                    {entityType === "gene" ? "dependency" : "sensitivity"}, use
                    the scatterplot filters as the criteria. When this is
                    unselected, the default filters are used to identify other
                    contexts.
                  </p>
                }
                popoverId={`apply-filters-popover`}
                trigger={["hover", "focus"]}
              />
            </span>
          </Checkbox>
          <div>
            <p
              style={{
                color: "gray",
                fontSize: "12px",
                marginBottom: "0px",
              }}
            >
              Using{" "}
              {useScatterPlotFiltersOnBoxPlot ? "Scatter Plot" : "Default"}{" "}
              Filters:
            </p>
            <p
              style={{
                color: "gray",
                fontSize: "12px",
                marginBottom: "0px",
              }}
            >
              T-test q-value between {boxPlotFDRRange && boxPlotFDRRange[0]} and{" "}
              {boxPlotFDRRange && boxPlotFDRRange[1]}
            </p>
            <p
              style={{
                color: "gray",
                fontSize: "12px",
                marginBottom: "0px",
              }}
            >
              Abs(effect size) between{" "}
              {boxPlotEffectSizeRange && boxPlotEffectSizeRange[0]} and{" "}
              {boxPlotEffectSizeRange && boxPlotEffectSizeRange[1]}
            </p>
            <p style={{ color: "gray", fontSize: "12px" }}>
              % of in-context lines{" "}
              {entityType === "gene" ? "dependent" : "sensitive"} between{" "}
              {boxPlotFracDepInRange && boxPlotFracDepInRange[0]} and{" "}
              {boxPlotFracDepInRange && boxPlotFracDepInRange[1]}
            </p>
          </div>
        </>
      )}
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
