import React from "react";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon, { TriggerType } from "src/common/components/InfoIcon";

interface PurpleHelpIconProps {
  tooltipText: string;
  popoverId: string;
  trigger?: TriggerType | TriggerType[] | undefined;
}

const PurpleHelpIcon: React.FC<PurpleHelpIconProps> = ({
  tooltipText,
  popoverId,
  trigger = ["hover", "focus"],
}) => {
  const customImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="help icon"
      className="icon"
    />
  );
  return (
    <InfoIcon
      target={customImg}
      popoverContent={<>{tooltipText}</>}
      popoverId={popoverId}
      trigger={trigger}
    />
  );
};

export default PurpleHelpIcon;
