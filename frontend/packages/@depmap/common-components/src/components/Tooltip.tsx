/**
 * Wraps react-boostrap's tooltip for easier use
 *
 */

import * as React from "react";
import {
  Tooltip as BSTooltip,
  TooltipProps,
  OverlayTrigger,
} from "react-bootstrap";

export const Tooltip = (
  props: Omit<TooltipProps, "content"> & {
    content: React.ReactNode;
    children: React.ReactNode; // passed with children syntax, just listing to indicate requirement
  }
) => {
  // for some reason, placement is a Tooltip prop, but passing it to Tooltip doesn't do anything. The example shows passing it to OverlayTrigger
  const { id, content, children, placement, ...remainingProps } = props;
  const overlay = (
    <BSTooltip id={id} {...remainingProps}>
      {content}
    </BSTooltip>
  );
  return (
    <OverlayTrigger overlay={overlay} placement={placement}>
      {children}
    </OverlayTrigger>
  );
};
