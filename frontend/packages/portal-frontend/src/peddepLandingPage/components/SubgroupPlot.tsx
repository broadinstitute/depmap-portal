import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";
import Plotly from "plotly.js";

interface SubGroupPlotProps {
  subgroup: string;
  subtypes: string[];
}

export default function SubGroupPlot(props: SubGroupPlotProps) {
  const { subgroup, subtypes } = props;

  const plotRef = useRef(null);

  const traceData = useMemo(() => {
    const subtypeValues = subtypes.reduce((acc, subtype) => {
      if (subtype in acc) {
        acc[subtype] += 1;
      } else {
        acc[subtype] = 1;
      }
      return acc;
    }, {} as any);

    return [
      {
        values: Object.values(subtypeValues),
        labels: Object.keys(subtypeValues),
        name: subgroup,
        hoverinfo: "label+percent+name",
        textposition: "none",
        hole: 0.7,
        type: "pie",
      },
    ];
  }, [subgroup, subtypes]);

  useEffect(() => {
    if (plotRef.current) {
      const layout = {
        // height: 300,
        // width: 600,
        showlegend: false,
        margin: {
          l: 10,
          r: 10,
          t: 10,
          b: 10,
        },
      };
      Plotly.newPlot(plotRef.current, traceData as Plotly.Data[], layout);
    }
  }, [traceData]);

  return (
    <div className={styles.subgroupPlot}>
      <hr />
      <h1>{subgroup}</h1>
      <div ref={plotRef} />
    </div>
  );
}
