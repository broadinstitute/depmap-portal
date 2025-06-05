import React from "react";
import { Panel } from "react-bootstrap";
import { ContextNameInfo } from "@depmap/types";
import { BoxPlotInfo } from "src/contextExplorer/models/types";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
} from "src/contextExplorer/utils";
import BoxPlot from "./BoxPlot";

interface SelectedContextBoxPlotPanelProps {
  topContextNameInfo: ContextNameInfo;
  selectedCode: string | undefined;
  selectedLevelZeroBoxData: BoxPlotInfo | null;
  selectedContextBoxData: BoxPlotInfo[] | null;
  handleSetMainPlotElement: (element: any) => void;
  xAxisRange: any[];
  entityType: string;
  activeKey: string | null;
  xAxisTitle: string;
  drugDottedLine?: number;
  urlPrefix?: string;
  tab?: string;
}

interface PanelBodyProps {
  selectedContextBoxData: BoxPlotInfo[];
  handleSetMainPlotElement: (element: any) => void;
  xAxisRange: any[];
  entityType: string;
  xAxisTitle: string;
  drugDottedLine?: number;
  selectedCode?: string;
  urlPrefix?: string;
  tab?: string;
}

const PanelBody = ({
  selectedContextBoxData,
  handleSetMainPlotElement,
  xAxisRange,
  entityType,
  xAxisTitle,
  drugDottedLine = undefined,
  selectedCode = undefined,
  urlPrefix = undefined,
  tab = undefined,
}: PanelBodyProps) => {
  return (
    <Panel.Body collapsible>
      {" "}
      <div>
        <BoxPlot
          boxData={selectedContextBoxData}
          onLoad={handleSetMainPlotElement}
          xAxisRange={xAxisRange}
          plotHeight={
            selectedContextBoxData.length * BOX_THICKNESS +
            BOX_PLOT_TOP_MARGIN +
            BOX_PLOT_BOTTOM_MARGIN
          }
          bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
          topMargin={BOX_PLOT_TOP_MARGIN}
          selectedCode={selectedCode}
          dottedLinePosition={
            entityType === "gene" ? -1 : drugDottedLine || -1.74
          }
          xAxisTitle={xAxisTitle}
          urlPrefix={urlPrefix}
          tab={tab}
        />
      </div>
    </Panel.Body>
  );
};

interface PanelTitleNoChildPlotsProps {
  topContextNameInfo: ContextNameInfo;
  selectedLevelZeroBoxData: BoxPlotInfo | null;
  handleSetMainPlotElement: (element: any) => void;
  xAxisRange: any[];
  entityType: string;
  drugDottedLine?: number;
  selectedCode?: string;
  urlPrefix?: string;
  tab?: string;
  activeKey: string | null;
}

interface Props {
  subtypeCode: string;
  selectedCode: string | undefined;
}
function SelectedLabel({ subtypeCode, selectedCode }: Props) {
  return (
    <span
      style={{
        fontSize: "12px",
        fontWeight: selectedCode === subtypeCode ? "600" : "normal",
        color: selectedCode === subtypeCode ? "#333333" : "#4479B2",
      }}
    >
      {subtypeCode}
    </span>
  );
}

const PanelHeading = ({
  topContextNameInfo,
  selectedLevelZeroBoxData,
  handleSetMainPlotElement,
  xAxisRange,
  entityType,
  activeKey,
  drugDottedLine = undefined,
  selectedCode = undefined,
  urlPrefix = undefined,
  tab = undefined,
}: PanelTitleNoChildPlotsProps) => {
  return (
    <Panel.Heading>
      <Panel.Title toggle>
        <div>
          {selectedLevelZeroBoxData !== null && activeKey === "SELECTED" && (
            <span
              style={{
                paddingRight: "4px",
                paddingTop: activeKey === "SELECTED" ? "0px" : "12px",
                fontSize: "12px",
                color: "#4479B2",
              }}
              className={"glyphicon glyphicon-chevron-up"}
            />
          )}

          {selectedLevelZeroBoxData && activeKey !== "SELECTED" ? (
            <>
              <BoxPlot
                boxData={[selectedLevelZeroBoxData]}
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
                urlPrefix={urlPrefix}
                tab={tab}
                isLevel0
              />
            </>
          ) : (
            selectedLevelZeroBoxData &&
            activeKey === "SELECTED" && (
              <SelectedLabel
                subtypeCode={topContextNameInfo!.subtype_code}
                selectedCode={selectedCode}
              />
            )
          )}
        </div>
      </Panel.Title>
    </Panel.Heading>
  );
};

export const SelectedContextBoxPlotPanel = ({
  topContextNameInfo,
  selectedLevelZeroBoxData,
  selectedCode,
  selectedContextBoxData,
  handleSetMainPlotElement,
  xAxisRange,
  entityType,
  activeKey,
  xAxisTitle,
  urlPrefix = undefined,
  tab = undefined,
  drugDottedLine = undefined,
}: SelectedContextBoxPlotPanelProps) => {
  return (
    <Panel eventKey="SELECTED">
      {(selectedContextBoxData === null ||
        selectedContextBoxData.length === 0) &&
      selectedLevelZeroBoxData ? (
        <Panel.Body>
          {" "}
          <div>
            <BoxPlot
              boxData={[selectedLevelZeroBoxData]}
              onLoad={handleSetMainPlotElement}
              xAxisRange={xAxisRange}
              plotHeight={
                BOX_THICKNESS + BOX_PLOT_TOP_MARGIN + BOX_PLOT_BOTTOM_MARGIN
              }
              bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
              topMargin={BOX_PLOT_TOP_MARGIN}
              dottedLinePosition={
                entityType === "gene" ? -1 : drugDottedLine || -1.74
              }
              xAxisTitle={xAxisTitle}
              urlPrefix={urlPrefix}
              tab={tab}
            />
          </div>
        </Panel.Body>
      ) : (
        <>
          <PanelHeading
            activeKey={activeKey}
            topContextNameInfo={topContextNameInfo}
            selectedLevelZeroBoxData={selectedLevelZeroBoxData}
            handleSetMainPlotElement={handleSetMainPlotElement}
            xAxisRange={xAxisRange}
            entityType={entityType}
            drugDottedLine={drugDottedLine}
            selectedCode={selectedCode}
            urlPrefix={urlPrefix}
            tab={tab}
          />
          {selectedContextBoxData && selectedContextBoxData.length > 0 && (
            <PanelBody
              selectedContextBoxData={selectedContextBoxData}
              handleSetMainPlotElement={handleSetMainPlotElement}
              xAxisRange={xAxisRange}
              entityType={entityType}
              drugDottedLine={drugDottedLine}
              selectedCode={selectedCode}
              xAxisTitle={xAxisTitle}
              urlPrefix={urlPrefix}
              tab={tab}
            />
          )}
        </>
      )}
    </Panel>
  );
};
