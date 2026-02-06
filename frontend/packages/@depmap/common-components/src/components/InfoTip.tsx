import React, { ReactNode } from "react";
import cx from "classnames";
import { Popover, OverlayTrigger } from "react-bootstrap";

interface Props {
  id: string;
  placement: "top" | "bottom" | "left" | "right";
  title: string;
  content: ReactNode;
}

export function InfoTip({ id, placement, title, content }: Props) {
  return (
    <OverlayTrigger
      trigger={["hover", "focus"]}
      placement={placement}
      overlay={
        <Popover id={id} title={title}>
          {content}
        </Popover>
      }
    >
      <span
        className={cx("glyphicon", "glyphicon-info-sign")}
        style={{ marginInlineStart: 8, top: 2, color: "#7B317C" }}
      />
    </OverlayTrigger>
  );
}
