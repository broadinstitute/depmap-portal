import React from "react";
import { Tooltip } from "@depmap/common-components";

interface Props {
  className: string;
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function ButtonWithTooltip({
  className,
  onClick,
  tooltip,
  children,
  disabled = false,
}: Props) {
  return (
    <Tooltip id={tooltip} content={tooltip} placement="top">
      <button
        type="button"
        className={className}
        aria-label={tooltip}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default ButtonWithTooltip;
