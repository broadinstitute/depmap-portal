import React, { useCallback, useContext } from "react";
import ReactDOM from "react-dom";
import { ApiContext } from "@depmap/api";
import { DataExplorerPlotConfigDimensionV2 } from "@depmap/types";
import {
  DataExplorerApiProvider,
  useDataExplorerApi,
} from "../../../contexts/DataExplorerApiContext";
import { Mode, State } from "../useDimensionStateManager/types";
import DimensionDetailsModal from "./DimensionDetailsModal";

interface Props {
  includeAllInContextOptions: boolean;
  index_type: string | null;
  mode: Mode;
  onChange: (dimension: DataExplorerPlotConfigDimensionV2) => void;
  state: State;
}

export default function useModal({
  includeAllInContextOptions,
  index_type,
  mode,
  onChange,
  state,
}: Props) {
  // We need to create duplicate providers for each of these contexts because
  // we're rendering a new React root with its own scope.
  const sharedApi = useContext(ApiContext);
  const dataExplorerApi = useDataExplorerApi();

  const onClickShowModal = useCallback(() => {
    const container = document.createElement("div");
    container.id = "dimension-details-modal";
    document.body.append(container);

    const unmount = () => {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    };

    ReactDOM.render(
      <ApiContext.Provider value={sharedApi}>
        <DataExplorerApiProvider {...dataExplorerApi}>
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
        </DataExplorerApiProvider>
      </ApiContext.Provider>,
      container
    );
  }, [
    sharedApi,
    dataExplorerApi,
    includeAllInContextOptions,
    index_type,
    mode,
    onChange,
    state,
  ]);

  return onClickShowModal;
}
