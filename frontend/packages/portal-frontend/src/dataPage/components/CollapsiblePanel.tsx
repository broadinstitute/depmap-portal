import { Accordion, OpenCloseSymbol } from "@depmap/interactive";
import React from "react";

export interface CollapsiblePanelProps {
  headerContent: any;
  bodyContent: any;
  openPanelOnLoad: boolean;
  keyPrefix: string;
  keySuffix: number;
}

export const CollapsiblePanel = ({
  headerContent,
  bodyContent,
  openPanelOnLoad,
  keyPrefix,
  keySuffix,
}: CollapsiblePanelProps) => {
  return (
    <div className={"CollapsiblePanel"}>
      <Accordion
        key={`${keyPrefix}${keySuffix}`}
        titleStyle={{ display: "flex" }}
        isOpen={openPanelOnLoad}
        title={headerContent}
        openCloseSymbol={OpenCloseSymbol.Caret}
        openingTransition={"max-height 0.2s ease"}
        openCloseSymbolStyle={{
          float: "left",
          marginRight: "10px",
          marginTop: "1px",
          position: "relative",
          lineHeight: "unset",
          color: "#4479B2",
        }}
      >
        {bodyContent}
      </Accordion>
    </div>
  );
};
