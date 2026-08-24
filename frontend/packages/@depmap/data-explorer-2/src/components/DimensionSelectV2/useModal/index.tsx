import React, { useCallback } from "react";
import ReactDOM from "react-dom";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import {
  Mode,
  OtherAxisExpansion,
  State,
} from "../useDimensionStateManager/types";
import DimensionDetailsModal from "./DimensionDetailsModal";

interface Props {
  includeAllInContextOptions: boolean;
  index_type: string | null;
  mode: Mode;
  onChange: (dimension: DataExplorerPlotConfigDimensionV2) => void;
  state: State;
  allowNullFeatureType: boolean;
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">;
  hiddenDatasets: Set<string>;
  allowExpansion: boolean;
  otherAxisExpansion: OtherAxisExpansion;
}

export default function useModal({
  includeAllInContextOptions,
  index_type,
  mode,
  onChange,
  state,
  allowNullFeatureType,
  valueTypes,
  hiddenDatasets,
  allowExpansion,
  otherAxisExpansion,
}: Props) {
  const onClickShowModal = useCallback(() => {
    const container = document.createElement("div");
    container.id = "dimension-details-modal";
    document.body.append(container);

    const unmount = () => {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    };

    ReactDOM.render(
      <DimensionDetailsModal
        mode={mode}
        index_type={index_type}
        initialState={state}
        onCancel={unmount}
        onChange={(dimension) => {
          onChange(dimension);
          unmount();
        }}
        includeAllInContextOptions={includeAllInContextOptions}
        allowNullFeatureType={allowNullFeatureType}
        valueTypes={valueTypes}
        hiddenDatasets={hiddenDatasets}
        allowExpansion={allowExpansion}
        otherAxisExpansion={otherAxisExpansion}
      />,
      container
    );
  }, [
    includeAllInContextOptions,
    allowNullFeatureType,
    valueTypes,
    hiddenDatasets,
    allowExpansion,
    otherAxisExpansion,
    index_type,
    mode,
    onChange,
    state,
  ]);

  return onClickShowModal;
}
