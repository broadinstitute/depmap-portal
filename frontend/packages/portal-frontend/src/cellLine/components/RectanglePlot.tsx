import { Tooltip } from "@depmap/common-components";
import React, { useEffect, useRef } from "react";
import StackedBoxPlotUtils from "src/cellLine/utilities/boxplotUtils";

export interface RectPlotProps {
  svgName: string;
  scoresMatrix: Array<Array<number | null>>; // matrix of z-scores across all cell lines
  labels: Array<string>; // gene or compound names
  cellLineColIndex: number; // index of the column with data for this cell line
  xAxisLabel: string;
  linkType: "gene" | "compound";
}

// HACK: This should be taken out when we update this tile to use Compounds instead of Compound Experiments
const attemptFindCompoundLabel = (compoundExpLabel: string) => {
  // ^       : Start of string
  // (.+?)   : Capture group 1 (the name) - matches any char non-greedily
  // \s\(    : Matches a space followed by a literal opening parenthesis
  // .* : Matches any characters inside the parentheses
  // \)      : Matches the closing parenthesis
  // $       : End of string
  const regex = /^(.+?)\s\(.*\)$/;
  const match = compoundExpLabel.match(regex);

  // If a match is found, return the first capture group, otherwise original string
  return match ? match[1] : compoundExpLabel;
};

const getLabelLinkUrl = (label: string, linkType: "gene" | "compound") => {
  return window.location.href
    .replace(/\/cell_line\/.*/, `/${linkType}/${encodeURIComponent(label)}`)
    .replace(window.location.search, "");
};

const RectanglePlot = ({
  svgName,
  scoresMatrix,
  labels,
  cellLineColIndex,
  xAxisLabel,
  linkType,
}: RectPlotProps) => {
  const d3Container = useRef(null);

  function getSortedNonNulls(numberArray: (number | null)[]) {
    const filtered = numberArray.filter((x) => x != null) as number[];
    return filtered.sort((a, b) => (a as number) - (b as number));
  }

  useEffect(() => {
    if (labels) {
      // Initialize the plot
      const boxplotUtils = new StackedBoxPlotUtils(
        svgName,
        d3Container,
        labels,
        scoresMatrix
      );

      // render the axes
      boxplotUtils.labelXAxis(xAxisLabel);

      // Identify and label outliers
      const q1Values: number[] = scoresMatrix.map((geneScores) => {
        return boxplotUtils.d3.quantile(getSortedNonNulls(geneScores), 0.25);
      });
      const q3Values: number[] = scoresMatrix.map((geneScores) => {
        return boxplotUtils.d3.quantile(getSortedNonNulls(geneScores), 0.75);
      });
      const interQuartileRanges = q1Values.map(
        (q1Val, i) => q3Values[i] - q1Val
      );
      const lowerCutoffs = q1Values.map(
        (q1Val, i) => q1Val - 1.5 * interQuartileRanges[i]
      );
      const upperCutoffs = q3Values.map(
        (q3Val, i) => q3Val + 1.5 * interQuartileRanges[i]
      );
      const isOutlier = (val: number | null, labelIndex: number) => {
        return (
          val !== null &&
          (val < lowerCutoffs[labelIndex] || val > upperCutoffs[labelIndex])
        );
      };
      const outliers = scoresMatrix.map((geneScores, i) => {
        return getSortedNonNulls(geneScores).filter((geneEffect) =>
          isOutlier(geneEffect, i)
        );
      });
      boxplotUtils.markOutliers(labels, outliers);

      // Render the whiskers
      const nonOutliers: number[][] = scoresMatrix.map((geneScores, i) => {
        return getSortedNonNulls(geneScores).filter(
          (geneEffect) => !isOutlier(geneEffect, i)
        );
      });
      const lowerWhiskerVals = nonOutliers.map((rowVals) =>
        Math.min(...rowVals)
      );
      const upperWhiskerVals = nonOutliers.map((rowVals) =>
        Math.max(...rowVals)
      );
      boxplotUtils.renderHorizontalLines(
        lowerWhiskerVals,
        upperWhiskerVals,
        "#A0A0A0"
      );
      boxplotUtils.renderVerticalTick(lowerWhiskerVals, "#A0A0A0", 4);
      boxplotUtils.renderVerticalTick(upperWhiskerVals, "#A0A0A0", 4);

      // Render the box (from one quartile to the other)
      boxplotUtils.renderBoxes(q1Values, q3Values, "#BBB");

      // Render the median value
      const medians: number[] = scoresMatrix.map((geneScores) => {
        return boxplotUtils.d3.quantile(getSortedNonNulls(geneScores), 0.5);
      });
      boxplotUtils.renderVerticalTick(medians, "#333", 2);

      // Render the values for this particular cell line in red
      const cellLineValues = scoresMatrix
        .filter((x) => x != null)
        .map((geneScores) => geneScores[cellLineColIndex]) as number[];
      boxplotUtils.renderPoints(cellLineValues, "#FFBA7A");
    }
  }, [svgName, scoresMatrix, labels, cellLineColIndex, xAxisLabel, linkType]);

  return (
    <div className="stacked-boxplot-plot">
      <div className="stacked-boxplot-labels-container">
        {labels.map((label, i) => (
          <p key={label} className="boxplot-label">
            <Tooltip
              key={`${label}-${i}`}
              id="pref-sens-compound-tooltip"
              content={label}
              placement="top"
            >
              <a
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                href={getLabelLinkUrl(
                  linkType === "compound"
                    ? attemptFindCompoundLabel(label)
                    : label,
                  linkType
                )}
              >
                {label}
              </a>
            </Tooltip>
          </p>
        ))}
      </div>
      <div className="stacked-boxplot-svg-container" ref={d3Container} />
    </div>
  );
};

export default RectanglePlot;
