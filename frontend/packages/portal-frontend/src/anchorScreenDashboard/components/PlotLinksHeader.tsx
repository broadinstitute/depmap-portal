import React from "react";
import { InfoTip } from "@depmap/common-components";

function PlotLinksHeader() {
  return (
    <div>
      <span>Comparing drug to control condition</span>
      <span style={{ position: "absolute" }}>
        <InfoTip
          id="plot-links"
          title="Comparing drug to control condition"
          content={
            <ul>
              <li>
                The “volcano” links will show a volcano plot of the differential
                dependency analysis produced by Chronos-compare. The x-axis
                shows difference in gene effect, negative values indicate
                greater dependency in the drug vs. control arm.
              </li>
              <br />
              <li>
                The “scatter” links will show a scatter plot of the drug vs the
                control arm gene effects.
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
