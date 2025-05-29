import React, { useEffect } from "react";
import * as Plotly from "plotly.js";
import { VolcanoPlot } from "../../plot/components/VolcanoPlot";
import { VolcanoData } from "src/plot/models/volcanoPlotModels";

interface CorrelationsPlotProps {
  featureType: string;
  data: VolcanoData[];
  selectedFeatures: string[];
  hasOtherSelectedFeatureTypeFeatures: boolean;
  forwardPlotSelectedFeatures: (
    featureType: string,
    newSelectedLabels: string[]
  ) => void;
}

export default function CorrelationsPlot(props: CorrelationsPlotProps) {
  const {
    featureType,
    data,
    selectedFeatures,
    hasOtherSelectedFeatureTypeFeatures,
    forwardPlotSelectedFeatures,
  } = props;

  const volcanoPlotsRef = React.useRef<any | null>(null);

  useEffect(() => {
    if (!volcanoPlotsRef.current) return;

    const traceHighlights: Array<number[]> = [];
    const traceIndexes: number[] = [];
    data.forEach((doseTrace, traceIndex) => {
      const traceOpacity = doseTrace.label?.map((label) => {
        if (selectedFeatures.length) {
          return selectedFeatures.includes(label) ? 1 : 0.05;
        }
        if (
          selectedFeatures.length === 0 &&
          hasOtherSelectedFeatureTypeFeatures
        ) {
          return 0.05;
        }

        return 1;
      });
      traceHighlights.push(traceOpacity);
      traceIndexes.push(traceIndex);
    });
    const update = { "marker.opacity": traceHighlights };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Plotly.restyle(volcanoPlotsRef.current, update, traceIndexes);
  }, [data, hasOtherSelectedFeatureTypeFeatures, selectedFeatures]);

  return (
    <div>
      <header
        style={{
          textAlign: "center",
          fontSize: "18px",
          backgroundColor: "#eee",
        }}
      >
        {featureType}
      </header>
      <VolcanoPlot
        ref={(el) => {
          volcanoPlotsRef.current = el;
        }}
        Plotly={Plotly}
        xLabel="Correlation Coefficient"
        yLabel="q value"
        data={data}
        onPointClick={(e) => {
          const selectedLabel = e.customdata as string;
          if (selectedFeatures.includes(selectedLabel)) {
            // deselect point if point is already selected
            forwardPlotSelectedFeatures(
              featureType,
              selectedFeatures.filter((label) => label !== selectedLabel)
            );
          } else {
            forwardPlotSelectedFeatures(featureType, [
              ...selectedFeatures,
              selectedLabel,
            ]);
          }
          // replace the entire marker object with the one provided
          // const update = {
          //     marker: {color: 'red'}
          // };
          // Plotly.restyle(volcanoPlotsRef.current, update)
        }}
      />
    </div>
  );
}
