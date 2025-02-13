import React, { useMemo } from "react";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import Heatmap from "src/plot/components/Heatmap";
import { Button } from "react-bootstrap";
import { ContextSummary } from "../models/types";
import DatatypeSelector from "./DatatypeSelector";
import { saveNewContext } from "src";
import {
  CONTEXT_EXPL_BAR_THICKNESS,
  getDataExplorerContextFromSelections,
} from "../utils";

interface ContextExplorerPlotProps {
  selectedContextName: string;
  data: ContextSummary;
  checkedDataValues: number[][];
  checkedDatatypes: Set<string>;
  updateDatatypeSelection: (clicked: string) => void;
  topContextName: string;
  overlappingDepmapIds: string[];
  customInfoImg: React.JSX.Element;
  handleSetPlotElement: (element: any) => void;
  plotElement: ExtendedPlotType | null;
}

function ContextExplorerPlot(props: ContextExplorerPlotProps) {
  const {
    data,
    checkedDataValues,
    selectedContextName,
    checkedDatatypes,
    updateDatatypeSelection,
    topContextName,
    overlappingDepmapIds,
    customInfoImg,
    handleSetPlotElement,
    plotElement,
  } = props;

  // data.data_types will be the Heatmap y-axis labels
  // The data.zVals is a list of lists, with indexes matching up to
  // each y-axis label. Each data_type corresponds to a list. Each value
  // in the list is either a 0, a non-zero integer, or 0.5, 1.5, 2.5, or 3.5.
  //
  // 0 (or 0.5) means there is NOT data
  // available for that cell line for the particular data_type
  //
  // Any non-zero integer/decimal means there IS data available. The precise non-zero
  // integer determines the color of the bar at that point. Color denotes
  // data category (OMICS, Loss of Function, or Compound Viability).
  //
  // An integer+0.5 means that at least 2 datatypes of been selected on the graph's y-axis. On selection
  // of the 2nd datatype, unselected datatype rows get 0.5 added to every value. All this does is decrease
  // the opacity of that row so that the user can visualize their selected datatypes of interest.

  const cellLineCountsBackwards = useMemo(() => {
    return checkedDataValues.map((datatypeVals) => {
      return [...datatypeVals].filter((x) => x > 0.5).length;
    });
  }, [checkedDataValues]);
  const cellLineCountsForwards = useMemo(() => {
    return [...cellLineCountsBackwards].reverse();
  }, [cellLineCountsBackwards]);

  const onMakeContextButtonClick = async () => {
    // Save the context currently selected as DatasetOverlap
    const allDepmapIds = data.all_depmap_ids.map((a) => a[1]);

    const context = getDataExplorerContextFromSelections(
      selectedContextName,
      checkedDatatypes,
      overlappingDepmapIds,
      topContextName,
      allDepmapIds
    );

    saveNewContext(context);
  };

  const xVals = useMemo(() => {
    return data.all_depmap_ids.map((item) => item[1]);
  }, [data]);

  const overlapCount = overlappingDepmapIds.length;
  const totalCellLines = data.all_depmap_ids.length;

  return (
    <div className={styles.plotContainer}>
      <div className={styles.overviewGraphHeader}>
        {selectedContextName === "All" ? (
          <>
            <h2>
              Data Availability{" "}
              {data.data_types.length > 0 && plotElement && (
                <span>(n={totalCellLines})</span>
              )}
            </h2>
            <h4>
              Available datasets will appear according to the context that you
              have chosen. Explore all of the cell lines we have available by
              selecting the datasets or choosing a lineage and disease context
              from the left.
            </h4>
          </>
        ) : (
          <>
            <h2>
              {selectedContextName} Data Availability{" "}
              {data.data_types.length > 0 && plotElement && (
                <span>(n={totalCellLines})</span>
              )}
            </h2>
            <h4>
              There are currently {totalCellLines} {selectedContextName} cell
              lines, each of which is represented in one or more of the below
              data types. Select your dataset type(s) of interest to see how
              many {selectedContextName} lines have data available.
            </h4>
          </>
        )}
      </div>
      <div className={styles.overviewPlotWrapper}>
        {plotElement && (
          <DatatypeSelector
            datatypes={[...data.data_types].reverse()}
            checked={checkedDatatypes}
            onClick={updateDatatypeSelection}
            customInfoImg={customInfoImg}
          />
        )}
        <fieldset className={styles.plot}>
          <div className={styles.plotHeaders}>
            {plotElement && <h5>CELL LINES</h5>}
          </div>
          {!plotElement && <PlotSpinner height="auto" />}
          <Heatmap
            dataTypeLabels={data.data_types}
            zVals={checkedDataValues}
            xVals={xVals}
            onLoad={handleSetPlotElement}
            height={CONTEXT_EXPL_BAR_THICKNESS * data.data_types.length}
            margin={{
              l: 0,

              r: 0,

              b: 0,

              t: 25,

              pad: 0,
            }}
          />
          {plotElement && (
            <fieldset className={styles.bottomLegend}>
              <div className={styles.lofBox} />
              <div className={styles.lofLabel}>Loss of Function</div>
              <div className={styles.omicsBox} />
              <div className={styles.lofLabel}>OMICS</div>
              <div className={styles.compoundBox} />
              <div className={styles.lofLabel}>Compound Viability</div>
              <div className={styles.subtypeBox} />
              <div className={styles.subtypeLabel}>Subtype</div>
            </fieldset>
          )}
        </fieldset>
        {plotElement && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateRows: `repeat(${
                  cellLineCountsForwards.length + 1
                }, ${CONTEXT_EXPL_BAR_THICKNESS - 1}px)`,
                marginLeft: "5px",
              }}
            >
              <div
                style={{
                  margin: 0,
                  gridRow: `${1}`,
                  alignSelf: "center",
                }}
              >
                <h5 style={{ paddingBottom: "10px" }}># OF CELL LINES</h5>
              </div>
              {cellLineCountsForwards.map((count, index) => (
                <div
                  style={{
                    margin: 0,
                    gridRow: `${index + 2}`,
                    alignSelf: "center",
                  }}
                  key={index}
                >
                  {count}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {plotElement && (
        <div className={styles.datasetOverlapContiner}>
          {checkedDatatypes.size === 0 ? (
            <div>
              Select dataset type(s) to see the representation of cell lines.
            </div>
          ) : (
            <>
              <div>
                <span style={{ fontWeight: "bold" }}>{overlapCount}</span>/
                {totalCellLines}{" "}
                {checkedDatatypes.size === 1
                  ? `cell lines have ${[...checkedDatatypes]} data`
                  : `cell lines exist in all of the following
              datasets: ${[...checkedDatatypes].join(", ")}`}
              </div>
            </>
          )}
          {((topContextName === "All" && checkedDatatypes.size > 0) ||
            topContextName !== "All") && (
            <Button
              className={styles.makeContextButton}
              onClick={onMakeContextButtonClick}
            >
              Make Context
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextExplorerPlot;
