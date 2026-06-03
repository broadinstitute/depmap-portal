import React from "react";
import { InfoTip } from "@depmap/common-components";

interface Props {
  // Heading shown above the column. JSX so callers can use <b> for emphasis.
  heading: React.ReactNode;
  // Title for the InfoTip popover.
  tooltipTitle: string;
  // Body of the InfoTip. Each dashboard explains its arms differently
  // (drug vs. control, parental vs. resistance), so this is fully delegated.
  tooltipContent: React.ReactNode;
}

function DependencyLinksHeader({
  heading,
  tooltipTitle,
  tooltipContent,
}: Props) {
  return (
    <div>
      <span style={{ fontWeight: "normal" }}>{heading}</span>
      <span style={{ position: "absolute" }}>
        <InfoTip
          id="plot-links"
          title={tooltipTitle}
          content={tooltipContent}
          placement="left"
        />
      </span>
    </div>
  );
}

export default DependencyLinksHeader;
