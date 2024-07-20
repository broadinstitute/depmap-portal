import React, { useCallback, useContext } from "react";
import ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import { Mode, State } from "../useDimensionStateManager/types";
import DimensionDetailsModal from "./DimensionDetailsModal";

interface Props {
  includeAllInContextOptions: boolean;
  index_type: string | null;
  mode: Mode;
  onChange: (dimension: DataExplorerPlotConfigDimension) => void;
  state: State;
}

export default function useModal({
  includeAllInContextOptions,
  index_type,
  mode,
  onChange,
  state,
}: Props) {
  const apiContext = useContext(ApiContext);

  const onClickShowModal = useCallback(() => {
    const container = document.createElement("div");
    container.id = "dimension-details-modal";
    document.body.append(container);

    const unmount = () => {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    };

    ReactDOM.render(
      <ApiContext.Provider value={apiContext}>
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
        />
      </ApiContext.Provider>,
      container
    );
  }, [
    apiContext,
    includeAllInContextOptions,
    index_type,
    mode,
    onChange,
    state,
  ]);

  return onClickShowModal;
}
