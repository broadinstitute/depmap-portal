import * as React from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { toStaticUrl } from "@depmap/globals";

export type TriggerType = "click" | "hover" | "focus";

interface Props {
  popoverContent: React.ReactNode;
  popoverId: string;
  target?: React.ReactNode;
  popoverTitle?: string;
  trigger?: TriggerType | Array<TriggerType>;
  placement?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const infoImg = (
  <img
    style={{
      height: "13px",
      paddingLeft: "4px",
      cursor: "pointer",
    }}
    src={toStaticUrl("img/gene_overview/info_purple.svg")}
    alt="description of term"
    className="icon"
  />
);

const InfoIcon = ({
  popoverContent,
  popoverId,
  target = infoImg,
  popoverTitle = undefined,
  trigger = "click",
  placement = "right",
  className = "",
}: Props) => {
  const popover = (
    <Popover id={popoverId} title={popoverTitle} className={className}>
      {popoverContent}
    </Popover>
  );
  return (
    <OverlayTrigger
      trigger={trigger}
      placement={placement}
      overlay={popover}
      rootClose
    >
      {target}
    </OverlayTrigger>
  );
};

export default InfoIcon;
