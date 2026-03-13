import React from "react";
import { InfoTip } from "@depmap/common-components";

function PlotLinksHeader() {
  return (
    <div>
      <span>Comparing parental to resistant model</span>
      <span style={{ position: "absolute" }}>
        <InfoTip
          id="plot-links"
          title="Comparing parental to resistant model"
          content={
            <ul>
              <li>
                The “volcano” links will show a volcano plot of the differential
                dependency analysis produced by Chronos-compare. The x-axis
                shows difference in gene effect, negative values indicate
                greater dependency in the parental vs. resistance model.
              </li>
              <br />
              <li>
                The “scatter” links will show a scatter plot of the parental vs
                the resistance model gene effects.
              </li>
            </ul>
          }
          placement="left"
        />
      </span>
    </div>
  );
}

export default PlotLinksHeader;
