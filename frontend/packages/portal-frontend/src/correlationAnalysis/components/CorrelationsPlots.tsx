import React from "react";
import * as Plotly from "plotly.js";
import { VolcanoPlot } from "../../plot/components/VolcanoPlot";

interface CorrelationsPlotsProps {
  featureTypesToShow: string[];
  dosesToFilter: string[];
  volcanoDataForFeatureType: { [key: string]: any };
}

export default function CorrelationsPlots(props: CorrelationsPlotsProps) {
  const {
    featureTypesToShow,
    dosesToFilter,
    volcanoDataForFeatureType,
  } = props;

  const filteredDosesForFeatureTypeVolcanoData = React.useCallback(
    (featureTypeVolcanoData) => {
      if (dosesToFilter.length) {
        const subset = {};
        dosesToFilter.forEach((dose) => {
          subset[dose] = featureTypeVolcanoData[dose];
        });
        return subset;
      }
      return featureTypeVolcanoData;
    },
    [dosesToFilter]
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2rem",
        marginBottom: "50px",
      }}
    >
      {featureTypesToShow.map((featureType) => {
        return (
          <div key={featureType + "-plot"}>
            <header
              style={{
                textAlign: "center",
                fontSize: "18px",
                backgroundColor: "lightgray",
              }}
            >
              {featureType}
            </header>
            <VolcanoPlot
              Plotly={Plotly}
              xLabel="Correlation Coefficient"
              yLabel="q value"
              bounds={"autosize"}
              data={Object.values(
                filteredDosesForFeatureTypeVolcanoData(
                  volcanoDataForFeatureType[featureType]
                )
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
