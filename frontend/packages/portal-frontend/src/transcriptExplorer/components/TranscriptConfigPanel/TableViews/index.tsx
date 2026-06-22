import React, { useRef } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import Section from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/Section";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import TableViewsContent from "./TableViewsContent";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  expansionAxis: "x" | "y";
}

function TableViews({ plot, expansionAxis }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Section
      title="Table Views"
      defaultOpen={false}
      innerRef={ref}
      onOpen={() => {
        setTimeout(() => {
          ref.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 100);
      }}
    >
      {isCompletePlot(plot) ? (
        <TableViewsContent plot={plot} expansionAxis={expansionAxis} />
      ) : (
        <div>Choose a gene and links to tables will appear here.</div>
      )}
    </Section>
  );
}

export default TableViews;
