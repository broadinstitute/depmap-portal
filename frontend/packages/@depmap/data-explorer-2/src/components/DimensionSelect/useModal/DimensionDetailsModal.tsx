/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { DepMap } from "@depmap/globals";
import {
  DataExplorerContext,
  DataExplorerPlotConfigDimension,
} from "@depmap/types";
import { deprecatedDataExplorerAPI } from "../../../services/deprecatedDataExplorerAPI";
import type { DeprecatedDataExplorerApiResponse } from "../../../services/deprecatedDataExplorerAPI";
import { Mode, State } from "../useDimensionStateManager/types";
import ModalDimensionSelect from "./ModalDimensionSelect";
import DatasetDetails from "./DatasetDetails";
import styles from "../../../styles/DimensionSelect.scss";

interface Props {
  mode: Mode;
  includeAllInContextOptions: boolean;
  index_type: string | null;
  onCancel: () => void;
  onChange: (dimension: DataExplorerPlotConfigDimension) => void;
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
  const [isLoading, setIsLoading] = useState(false);
  const [dimension, setDimension] = useState(initialState.dimension);

  const [details, setDetails] = useState<
    DeprecatedDataExplorerApiResponse["fetchDatasetDetails"] | null
  >(null);

  useEffect(() => {
    if (!dimension.dataset_id) {
      setDetails(null);
    } else {
      (async () => {
        setIsLoading(true);

        try {
          const fetchedDetails = await deprecatedDataExplorerAPI.fetchDatasetDetails(
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
  }, [dimension]);

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

            const onSave = (context: DataExplorerContext) => {
              setDimension((prev) => ({ ...prev, context }));
            };

            DepMap.saveNewContext({ context_type }, null, onSave);
          }}
          onClickSaveAsContext={() => {
            const onSave = (context: DataExplorerContext) => {
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
          onClick={() => onChange(dimension as DataExplorerPlotConfigDimension)}
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
