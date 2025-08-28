import React, { useCallback, useRef, useState } from "react";
import { PartialDataExplorerPlotConfig } from "@depmap/types";
import { isBreadboxOnlyMode } from "../../../../../isBreadboxOnlyMode";
import renderConditionally from "../../../../../utils/render-conditionally";
import { PlotConfigReducerAction } from "../../../reducers/plotConfigReducer";
import Section from "../../Section";
import PrecomputedAssociations from "./PrecomputedAssociations";
import LegacyPrecomputedAssociations from "./LegacyPrecomputedAssociations";

const Associations = isBreadboxOnlyMode
  ? PrecomputedAssociations
  : LegacyPrecomputedAssociations;

interface Props {
  plot: PartialDataExplorerPlotConfig;
  dispatch: (action: PlotConfigReducerAction) => void;
}

function PrecomputedAssociationsSection({ plot, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectY = useCallback(
    (
      dataset_id: string,
      slice_label: string,
      slice_type: string,
      given_id?: string
    ) => {
      dispatch({
        type: "select_scatter_y_slice",
        payload: {
          dataset_id,
          slice_label,
          slice_type,
          given_id: isBreadboxOnlyMode ? given_id : undefined,
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
      <Associations
        show={open}
        plot={plot}
        onSelectY={handleSelectY}
        sectionRef={sectionRef}
      />
    </Section>
  );
}

export default renderConditionally(PrecomputedAssociationsSection);
