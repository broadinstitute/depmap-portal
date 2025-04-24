import * as React from "react";
import { useEffect, useContext, useState, useMemo, useRef } from "react";
import { Button } from "react-bootstrap";
import { getDapi } from "src/common/utilities/context";
import styles from "src/peddepLandingPage/styles/PeddepPage.scss";
import { ApiContext } from "@depmap/api";
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
    }, {});

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
  console.log(traceData);
  useEffect(() => {
    const layout = {
      // annotations: [
      //   {
      //     // font: {
      //     //   size: 20
      //     // },
      //     text: 'label',
      //     // x: annotatedPoint.Cor,
      //     // y: yPos,
      //     xref: "x",
      //     yref: "y",
      //     arrowhead: 0,
      //     ax: -50,
      //     ay: 20,
      //     standoff: 4,
      //   }
      // ],
      height: 200,
      // width: 600,
      showlegend: false,
      margin: {
        l: 10,
        r: 10,
        t: 10,
        b: 10,
      },
    };
    Plotly.newPlot(plotRef.current, traceData, layout);
  }, [traceData]);

  return (
    <div className={styles.subgroupPlot}>
      <hr />
      <h1>{subgroup}</h1>
      <div ref={plotRef} />
    </div>
  );
}
