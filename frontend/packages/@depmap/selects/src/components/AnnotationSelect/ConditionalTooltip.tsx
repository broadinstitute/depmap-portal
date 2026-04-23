import React from "react";
import { Tooltip } from "@depmap/common-components";

function ConditionalTooltip({
  showTooltip,
  content,
  children,
}: {
  showTooltip: boolean | null | undefined;
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!showTooltip) {
    return children;
  }

  return (
    <Tooltip id="annotation-select-tooltip" content={content} placement="top">
      {children}
    </Tooltip>
  );
}

export default ConditionalTooltip;
