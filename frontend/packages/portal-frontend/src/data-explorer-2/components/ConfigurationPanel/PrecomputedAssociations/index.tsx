import React, { useCallback, useRef, useState } from "react";
import { renderConditionally } from "@depmap/data-explorer-2";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { PlotConfigReducerAction } from "src/data-explorer-2/reducers/plotConfigReducer";
import Section from "src/data-explorer-2/components/Section";
import PrecomputedAssociations from "src/data-explorer-2/components/ConfigurationPanel/PrecomputedAssociations/PrecomputedAssociations";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function PrecomputedAssociationsSection({ plot, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectY = useCallback(
    (dataset_id: string, entity_label: string, entity_type: string) => {
      dispatch({
        type: "select_scatter_y_entity",
        payload: {
          dataset_id,
          entity_label,
          entity_type,
        },
      });
    },
    [dispatch]
  );

  return (
    <Section
      innerRef={sectionRef}
      title="Pre-computed Associations"
      defaultOpen={false}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <PrecomputedAssociations
        show={open}
        plot={plot}
        onSelectY={handleSelectY}
        sectionRef={sectionRef}
      />
    </Section>
  );
}

export default renderConditionally(PrecomputedAssociationsSection);
