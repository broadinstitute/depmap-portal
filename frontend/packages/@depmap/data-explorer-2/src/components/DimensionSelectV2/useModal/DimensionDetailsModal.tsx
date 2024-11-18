/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { DepMap } from "@depmap/globals";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";
import {
  DataExplorerApiResponse,
  useDataExplorerApi,
} from "../../../contexts/DataExplorerApiContext";
import { Mode, State } from "../useDimensionStateManager/types";
import ModalDimensionSelect from "./ModalDimensionSelect";
import DatasetDetails from "./DatasetDetails";
import styles from "../../../styles/DimensionSelect.scss";

interface Props {
  mode: Mode;
  includeAllInContextOptions: boolean;
  index_type: string | null;
  onCancel: () => void;
  onChange: (dimension: DataExplorerPlotConfigDimensionV2) => void;
  initialState: State;
}

function DimensionDetailsModal({
  mode,
  includeAllInContextOptions,
  index_type,
  onChange,
  onCancel,
  initialState,
}: Props) {
  const api = useDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [dimension, setDimension] = useState(initialState.dimension);

  const [details, setDetails] = useState<
    DataExplorerApiResponse["fetchDatasetDetails"] | null
  >(null);

  useEffect(() => {
    if (!dimension.dataset_id) {
      setDetails(null);
    } else {
      (async () => {
        setIsLoading(true);

        try {
          const fetchedDetails = await api.fetchDatasetDetails(
            dimension.dataset_id as string
          );
          setDetails(fetchedDetails);
        } catch (e) {
          window.console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [api, dimension]);

  return (
    <Modal show bsSize="large" onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>Dataset Details</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.DimensionDetailsModal}>
        <ModalDimensionSelect
          value={dimension}
          onChange={setDimension}
          initialDataType={initialState.dataType || undefined}
          mode={mode}
          index_type={index_type}
          includeAllInContextOptions={includeAllInContextOptions}
          onClickCreateContext={() => {
            const context_type = dimension.slice_type;

            const onSave = (context: DataExplorerContextV2) => {
              setDimension((prev) => ({ ...prev, context }));
            };

            DepMap.saveNewContext({ context_type }, null, onSave);
          }}
          onClickSaveAsContext={() => {
            const onSave = (context: DataExplorerContextV2) => {
              setDimension((prev) => ({ ...prev, context }));
            };

            DepMap.saveNewContext(dimension.context, null, onSave);
          }}
        />
        <DatasetDetails isLoading={isLoading} details={details} />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          bsStyle="primary"
          onClick={() =>
            onChange(dimension as DataExplorerPlotConfigDimensionV2)
          }
          disabled={
            !dimension.dataset_id || dimension === initialState.dimension
          }
        >
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default DimensionDetailsModal;
