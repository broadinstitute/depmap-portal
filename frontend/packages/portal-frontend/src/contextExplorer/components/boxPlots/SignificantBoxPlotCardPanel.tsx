import React from "react";
import { Panel } from "react-bootstrap";
import { OtherSignificantBoxCardData as OtherSigBoxCardData } from "src/contextExplorer/models/types";
import {
  BOX_PLOT_BOTTOM_MARGIN,
  BOX_PLOT_TOP_MARGIN,
  BOX_THICKNESS,
} from "src/contextExplorer/utils";
import BoxPlot from "src/contextExplorer/components/boxPlots/BoxPlot";

interface SignificantBoxPlotsPanelProps {
  activeKey: string | null;
  level0Code: string;
  setXAxisRange: (range: any[]) => void;
  xAxisRange: any[];
  entityType: string;
  drugDottedLine?: number;
  card: OtherSigBoxCardData;
  urlPrefix?: string;
  tab?: string;
  selectedCode?: string;
}

interface SignificantPlotPanelHeadingProps {
  activeKey: string | null;
  level0Code: string;
  setXAxisRange: (element: any) => void;
  xAxisRange: any;
  card: OtherSigBoxCardData;
  entityType: string;
  drugDottedLine?: number;
  urlPrefix?: string;
  tab?: string;
  selectedCode?: string | undefined;
}

const SignificantPlotPanelHeading = ({
  activeKey,
  level0Code,
  setXAxisRange,
  xAxisRange,
  card,
  entityType,
  drugDottedLine = undefined,
  urlPrefix = undefined,
  tab = undefined,
  selectedCode = undefined,
}: SignificantPlotPanelHeadingProps) => {
  return (
    <Panel.Heading>
      <Panel.Title toggle>
        <div>
          {activeKey === level0Code && (
            <span
              style={{
                paddingRight: "8px",
                paddingTop: activeKey === level0Code ? "0px" : "12px",
                fontSize: "12px",
                color: "#4479B2",
              }}
              className={"glyphicon glyphicon-chevron-down"}
            />
          )}
          {activeKey !== level0Code ? (
            <BoxPlot
              plotName={`${level0Code}-header`}
              boxData={[card[level0Code].levelZeroPlotInfo]}
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
              urlPrefix={urlPrefix}
              tab={tab}
            />
          ) : (
            activeKey === level0Code && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: selectedCode === level0Code ? "600" : "normal",
                  color: selectedCode === level0Code ? "#333333" : "#4479B2",
                }}
              >
                {level0Code}
              </span>
            )
          )}
        </div>
      </Panel.Title>
    </Panel.Heading>
  );
};

export function SignificantBoxPlotCardPanel({
  activeKey,
  level0Code,
  setXAxisRange,
  xAxisRange,
  card,
  entityType,
  drugDottedLine = undefined,
  urlPrefix = undefined,
  tab = undefined,
  selectedCode = undefined,
}: SignificantBoxPlotsPanelProps) {
  return (
    <>
      <SignificantPlotPanelHeading
        activeKey={activeKey}
        level0Code={level0Code}
        setXAxisRange={setXAxisRange}
        xAxisRange={xAxisRange}
        card={card}
        entityType={entityType}
        drugDottedLine={drugDottedLine}
        urlPrefix={urlPrefix}
        tab={tab}
        selectedCode={selectedCode}
      />
      <Panel.Body collapsible>
        {activeKey === level0Code &&
          card[level0Code].subContextInfo.length > 0 && (
            <BoxPlot
              plotName={`${level0Code} box plot`}
              boxData={[...card[level0Code].subContextInfo].reverse()}
              onLoad={() => {}}
              setXAxisRange={setXAxisRange}
              xAxisRange={xAxisRange}
              plotHeight={
                card[level0Code].subContextInfo.length * BOX_THICKNESS +
                BOX_PLOT_TOP_MARGIN +
                BOX_PLOT_BOTTOM_MARGIN
              }
              xAxisTitle={""}
              bottomMargin={BOX_PLOT_BOTTOM_MARGIN}
              topMargin={BOX_PLOT_TOP_MARGIN}
              dottedLinePosition={
                entityType === "gene" ? -1 : drugDottedLine || -1.74
              }
              urlPrefix={urlPrefix}
              tab={tab}
            />
          )}
      </Panel.Body>
    </>
  );
}
