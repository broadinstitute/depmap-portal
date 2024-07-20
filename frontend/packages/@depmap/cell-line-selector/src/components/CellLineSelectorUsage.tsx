import * as React from "react";
import { enabledFeatures } from "@depmap/globals";

export const CellLineSelectorUsage = () => {
  return (
    <ul>
      <li>
        For instance, you can select a list to find your cell lines on plots.
        This works in Data Explorer (scatter plot only), gene pages, and
        compound pages.
      </li>
      {enabledFeatures.two_class_comparison && (
        <li>
          In Custom Analyses, you can run Associations on a subset of cell lines
          defined by the list, or use the list to define in- and out-groups for
          Two-Class Comparison.
        </li>
      )}
    </ul>
  );
};
