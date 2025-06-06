import React, { useCallback } from "react";
import ReactDOM from "react-dom";
import { DataExplorerPlotConfigDimension } from "@depmap/types";
import {
  DeprecatedDataExplorerApiProvider,
  useDeprecatedDataExplorerApi,
} from "../../../contexts/DeprecatedDataExplorerApiContext";
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
  // We need to create a duplicate provider because
  // we're rendering a new React root with its own scope.
  const dataExplorerApi = useDeprecatedDataExplorerApi();

  const onClickShowModal = useCallback(() => {
    const container = document.createElement("div");
    container.id = "dimension-details-modal";
    document.body.append(container);

    const unmount = () => {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    };

    ReactDOM.render(
      <DeprecatedDataExplorerApiProvider {...dataExplorerApi}>
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
      </DeprecatedDataExplorerApiProvider>,
      container
    );
  }, [
    dataExplorerApi,
    includeAllInContextOptions,
    index_type,
    mode,
    onChange,
    state,
  ]);

  return onClickShowModal;
}
