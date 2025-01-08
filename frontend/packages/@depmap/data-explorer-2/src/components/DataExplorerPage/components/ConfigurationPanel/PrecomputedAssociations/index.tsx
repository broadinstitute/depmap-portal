import React, { useCallback, useRef, useState } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import renderConditionally from "../../../../../utils/render-conditionally";
import { PlotConfigReducerAction } from "../../../reducers/plotConfigReducer";
import Section from "../../Section";
import PrecomputedAssociations from "./PrecomputedAssociations";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function PrecomputedAssociationsSection({ plot, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectY = useCallback(
    (dataset_id: string, slice_label: string, slice_type: string) => {
      dispatch({
        type: "select_scatter_y_slice",
        payload: {
          dataset_id,
          slice_label,
          slice_type,
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
