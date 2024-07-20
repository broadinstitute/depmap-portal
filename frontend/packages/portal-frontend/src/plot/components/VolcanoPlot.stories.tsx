import * as Plotly from "plotly.js";
import * as models from "src/plot/models/volcanoPlotModels";
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { VolcanoPlot } from "./VolcanoPlot";

export default {
  title: "Components/Plot/VolcanoPlot",
  component: VolcanoPlot,
};

const data: Array<models.VolcanoData> = [
  {
    x: [0.67, -0.522, 0.4554, 0.409, -0.309, 0.1932, -0.148, 0.0379],
    y: [0.0338, 0.121, 0.1858, 0.239, 0.384, 0.592, 0.682, 0.922],
    label: [
      "KDM7A",
      "PSG7",
      "MAP4K4",
      "SOX10",
      "HNF1B",
      "ANOS1",
      "SWI5",
      "MED1",
    ],
    text: [
      "KDM7A",
      "PSG7",
      "MAP4K4",
      "SOX10",
      "HNF1B",
      "ANOS1",
      "SWI5",
      "MED1",
    ].map((label: string) => `<b>${label}</b>`),
    isSignificant: [false, false, false, false, false, true, true, true],
  },
];

const highlightedPoints = [0, 2, 4];

export const MostFeatures = () => {
  const plotlyRef = React.useRef(null);
  const [dataToggle, setDataToggle] = useState<boolean>(true);
  const [outlineToggle, setOutlineToggle] = useState<boolean>(true);
  data[0].color = dataToggle ? "red" : "blue";

  const memoizedOnSelectedLabelChange = useCallback(
    (geneName: string) => console.log(`${geneName} clicked`),
    []
  );

  /**
   * renderOutline
   * The dependency array also includes dataToggle, because we want to
   */
  useEffect(() => {
    if (plotlyRef.current) {
      Plotly.restyle(plotlyRef.current, {
        "marker.line.width": outlineToggle ? 0 : 2,
      } as any);
    }
  }, [outlineToggle, dataToggle]);

  return (
    <>
      {/* this button demonstrates how the component reacts when its props changes */}
      <button
        type="button"
        onClick={() => setDataToggle(!dataToggle)}
        className="btn btn-default"
      >
        Change color via props
      </button>
      <button
        type="button"
        onClick={() => setOutlineToggle(!outlineToggle)}
        className="btn btn-default"
      >
        Change outline via Plotly.restyle
      </button>
      <VolcanoPlot
        Plotly={Plotly}
        ref={plotlyRef}
        idPrefixForUniqueness="volcano-story"
        xLabel="correlation"
        yLabel="PValue"
        data={data}
        // resizer={PlotResizer}
        // logging event handlers??
        highlightedPoints={highlightedPoints}
        onSelectedLabelChange={memoizedOnSelectedLabelChange}
        downloadIconWidgetProps={{
          downloadFilename: "story_volcano",
        }}
      />
    </>
  );
};
