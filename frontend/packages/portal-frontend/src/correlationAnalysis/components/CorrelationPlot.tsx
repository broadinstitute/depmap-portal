import React, { useEffect, useState } from "react";
import * as Plotly from "plotly.js";
import { VolcanoPlot } from "../../plot/components/VolcanoPlot";
import { VolcanoData } from "src/plot/models/volcanoPlotModels";

interface CorrelationsPlotProps {
  featureType: string;
  data: VolcanoData[];
}

export default function CorrelationsPlot(props: CorrelationsPlotProps) {
  const { featureType, data } = props;

  const volcanoPlotsRef = React.useRef<any | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!volcanoPlotsRef.current) return;

    const traceHighlights: Array<number[]> = [];
    const traceIndexes: number[] = [];
    data.forEach((doseTrace, traceIndex) => {
      const traceOpacity = doseTrace.label?.map((label) => {
        if (selectedLabels.length) {
          return selectedLabels.includes(label) ? 1 : 0.1;
        }

        return 1;
      });
      traceHighlights.push(traceOpacity);
      traceIndexes.push(traceIndex);
    });
    const update = { "marker.opacity": traceHighlights };

    Plotly.restyle(volcanoPlotsRef.current, update, traceIndexes);
  }, [data, selectedLabels]);

  return (
    <div>
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
        ref={(el) => {
          volcanoPlotsRef.current = el;
        }}
        Plotly={Plotly}
        xLabel="Correlation Coefficient"
        yLabel="q value"
        bounds={"autosize"}
        data={data}
        onPointClick={(e) => {
          const selectedLabel = e.customdata as string;
          if (selectedLabels.includes(selectedLabel)) {
            // deselect point if point is already selected
            setSelectedLabels(
              selectedLabels.filter((label) => label != selectedLabel)
            );
          } else {
            setSelectedLabels([...selectedLabels, selectedLabel]);
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
