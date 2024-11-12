import React from "react";
import { Checkbox } from "react-bootstrap";
import InfoIcon from "src/common/components/InfoIcon";

interface Props {
  entityType: string;
  useScatterPlotFiltersOnBoxPlot: boolean;
  handleUseScatterPlotFiltersClicked: () => void;
  boxPlotFDRRange: number[] | null;
  boxPlotEffectSizeRange: number[] | null;
  boxPlotFracDepInRange: number[] | null;
  customInfoImg: React.JSX.Element;
}

function ApplyFilters({
  entityType,
  useScatterPlotFiltersOnBoxPlot,
  handleUseScatterPlotFiltersClicked,
  boxPlotFDRRange,
  boxPlotEffectSizeRange,
  boxPlotFracDepInRange,
  customInfoImg,
}: Props) {
  return (
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
                selective {entityType === "gene" ? "dependency" : "sensitivity"}
                , use the scatterplot filters as the criteria. When this is
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
          Using {useScatterPlotFiltersOnBoxPlot ? "Scatter Plot" : "Default"}{" "}
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
        {entityType === "gene" && (
          <p style={{ color: "gray", fontSize: "12px" }}>
            % of in-context lines dependent between{" "}
            {boxPlotFracDepInRange && boxPlotFracDepInRange[0]} and{" "}
            {boxPlotFracDepInRange && boxPlotFracDepInRange[1]}
          </p>
        )}
      </div>
    </>
  );
}

export default React.memo(ApplyFilters);
