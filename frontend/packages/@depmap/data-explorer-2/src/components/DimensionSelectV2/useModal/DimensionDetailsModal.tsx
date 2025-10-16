/* eslint-disable react/jsx-props-no-spreading */
import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { breadboxAPI, cached } from "@depmap/api";
import { DepMap } from "@depmap/globals";
import {
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";
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
  allowNullFeatureType: boolean;
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">;
}

function DimensionDetailsModal({
  mode,
  includeAllInContextOptions,
  index_type,
  onChange,
  onCancel,
  initialState,
  allowNullFeatureType,
  valueTypes,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [dimension, setDimension] = useState(initialState.dimension);

  const [description, setDescription] = useState<string | undefined | null>(
    undefined
  );

  useEffect(() => {
    if (!dimension.dataset_id) {
      setDescription(undefined);
    } else {
      (async () => {
        setIsLoading(true);

        try {
          const dataset = await cached(breadboxAPI).getDataset(
            dimension.dataset_id as string
          );

          setDescription(dataset.description);
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
      <Modal.Body className={styles.DimensionDetailsModalV2}>
        <ModalDimensionSelect
          value={dimension}
          onChange={setDimension}
          initialDataType={initialState.dataType || undefined}
          mode={mode}
          index_type={index_type}
          includeAllInContextOptions={includeAllInContextOptions}
          allowNullFeatureType={allowNullFeatureType}
          valueTypes={valueTypes}
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
        <DatasetDetails isLoading={isLoading} description={description} />
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
