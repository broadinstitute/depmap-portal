import React, { useRef } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import Section from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/Section";
import LinksContent from "./LinksContent";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  expansionAxis: "x" | "y";
}

function DataExplorerLinks({ plot, expansionAxis }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Section
      title="Data Explorer Links"
      defaultOpen={false}
      innerRef={ref}
      onOpen={() => {
        setTimeout(() => {
          ref.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }}
    >
      <LinksContent plot={plot} expansionAxis={expansionAxis} />
    </Section>
  );
}

export default DataExplorerLinks;
