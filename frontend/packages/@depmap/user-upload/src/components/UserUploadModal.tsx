/* eslint-disable */
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Col,
  Modal,
  Form,
  FormGroup,
  ControlLabel,
  FormControl,
  Radio,
  HelpBlock,
  Button,
  Alert,
  Row,
} from "react-bootstrap";

import { ProgressTracker } from "@depmap/common-components";
import { CeleryTask, ComputeResponse } from "@depmap/compute";
import { UploadFormat, UserUploadArgs, UploadTask } from "@depmap/user-upload";

import "../styles/UserUploadModal.scss";
import { DataTypeEnum } from "../models/userUploads";

type UserUploadModalProps = {
  show: boolean;
  onHide: () => void;
  uploadFormat: UploadFormat;
  isPrivate: boolean;
  isTransient: boolean;
  taskKickoffFunction: (userUploadArgs: UserUploadArgs) => Promise<UploadTask>;
  groups?: Array<{ groupId: number; displayName: string }>;
  dataTypes?: DataTypeEnum[]; // Required for private uploads, but I think this modal is also used for non-private custom uploads
  getTaskStatus: (taskIds: string) => Promise<ComputeResponse>;
};

const FormattingHelp = (transposed: boolean) => {
  if (transposed) {
    return (
      <div>
        <div>DepMap IDs are row headers and features are column headers.</div>

        <details>
          <summary>Formatting example</summary>
          <table id="upload-example-table">
            <thead>
              <tr>
                <th />
                <th>pre-treatment</th>
                <th>post-treatment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ACH-000001</td>
                <td>0.05</td>
                <td>0.34</td>
              </tr>
              <tr>
                <td>ACH-000002</td>
                <td>0.4</td>
                <td>NA</td>
              </tr>
            </tbody>
          </table>

          <div>Which in CSV format would be:</div>
          <pre>
            <div>,pre-treatment,post-treatment</div>
            <div>ACH-000001,0.05,0.34</div>
            <div>ACH-000002,0.4,</div>
          </pre>
        </details>
      </div>
    );
  }
  return (
    <div>
      <div>DepMap IDs are column headers and features are row headers.</div>

      <details>
        <summary>Formatting example</summary>
        <table id="upload-example-table">
          <thead>
            <tr>
              <th />
              <th>ACH-000001</th>
              <th>ACH-000002</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>pre-treatment</td>
              <td>0.05</td>
              <td>0.4</td>
            </tr>
            <tr>
              <td>post-treatment</td>
              <td>0.34</td>
              <td>NA</td>
            </tr>
          </tbody>
        </table>

        <div>Which in CSV format would be:</div>
        <pre>
          <div>,ACH-000001,ACH-000002</div>
          <div>pre-treatment,0.05,0.4</div>
          <div>post-treatment,0.34,</div>
        </pre>
      </details>
    </div>
  );
};

export const UploadForm = (
  uploadFormat: UploadFormat,
  isPrivate: boolean,
  isTransient: boolean,
  groups: Array<{ groupId: number; displayName: string }>,
  dataTypes: DataTypeEnum[],
  taskKickoffFunction: (userUploadArgs: UserUploadArgs) => Promise<UploadTask>,
  getTaskStatus: (taskIds: string) => Promise<ComputeResponse>
) => {
  // Form inputs
  const [displayName, setDisplayName] = useState("");
  const [units, setUnits] = useState("");
  const [transposed, setTransposed] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | undefined>(undefined);
  const [taigaId, setTaigaId] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState(
    groups.length > 0 ? groups[0].groupId : undefined
  );
  const [selectedDataType, setSelectedDataType] = useState(
    dataTypes.length > 0 ? DataTypeEnum.user_upload : undefined
  );

  // If the user tries to upload without filling the form completely
  const [showValidation, setShowValidation] = useState(false);

  // Controls whether the form is disabled, and when to kick off (by rednering) the progress tracker
  const [taskRunning, setTaskRunning] = useState(false);

  // Response from the initial query submission, gets passed into ProgressTracker
  const [submissionResponse, setSubmissionResponse] = useState<
    Promise<UploadTask> | undefined
  >(undefined);
  // Completed task (either failed or successful)
  const [uploadTask, setUploadTask] = useState<UploadTask | undefined>(
    undefined
  );

  const buttonLabel = isTransient ? `Plot my dataset` : "Upload";

  useEffect(() => {
    setTaskRunning(false);
    setUploadTask(undefined);
  }, [displayName, units, transposed, uploadFile, taigaId, selectedGroup]);

  const taskKickoffFunctionArgs: UserUploadArgs = {
    displayName,
    units,
    transposed,
    uploadFile,
    taigaId,
    selectedGroup,
    selectedDataType,
  };

  const onComplete = (result: CeleryTask) => {
    setUploadTask(result as UploadTask);
    setTaskRunning(false);
  };

  const onSubmit = () => {
    if (
      !taskRunning &&
      displayName !== "" &&
      units !== "" &&
      (uploadFormat === UploadFormat.File
        ? uploadFile !== undefined
        : taigaId !== undefined)
    ) {
      setUploadTask(undefined); // clear any old result
      setTaskRunning(true);

      // make the submission
      setSubmissionResponse(
        taskKickoffFunction(taskKickoffFunctionArgs) as Promise<UploadTask>
      );
    } else if (
      displayName === "" ||
      units === "" ||
      (uploadFormat === UploadFormat.File
        ? uploadFile === undefined
        : taigaId === undefined)
    ) {
      setShowValidation(true);
    }
  };

  return (
    <>
      <Form disabled={taskRunning} horizontal>
        <FormGroup
          controlId="displayName"
          validationState={
            (showValidation &&
              (displayName.length > 0 ? "success" : "error")) ||
            null
          }
        >
          <Col componentClass={ControlLabel} sm={3}>
            Display name
          </Col>
          <Col sm={9}>
            <FormControl
              type="text"
              value={displayName}
              onChange={(e: React.FormEvent<HTMLInputElement & FormControl>) =>
                setDisplayName(e.currentTarget.value)
              }
              disabled={taskRunning}
              required
            />
          </Col>
        </FormGroup>

        <FormGroup
          controlId="units"
          validationState={
            (showValidation && (units.length > 0 ? "success" : "error")) || null
          }
        >
          <Col componentClass={ControlLabel} sm={3}>
            Units
          </Col>
          <Col sm={9}>
            <FormControl
              type="text"
              value={units}
              onChange={(e: React.FormEvent<HTMLInputElement & FormControl>) =>
                setUnits(e.currentTarget.value)
              }
              disabled={taskRunning}
              required
            />
          </Col>
        </FormGroup>

        <FormGroup controlId="orientation">
          <Col componentClass={ControlLabel} sm={3}>
            Orientation
          </Col>
          <Col sm={9}>
            <div>
              <Radio
                name="radioGroup"
                checked={transposed}
                onChange={() => {
                  setTransposed(true);
                }}
                disabled={taskRunning}
                inline
              >
                Cell lines are rows
              </Radio>
              <Radio
                name="radioGroup"
                checked={!transposed}
                onChange={() => {
                  setTransposed(false);
                }}
                disabled={taskRunning}
                inline
              >
                Cell lines are columns
              </Radio>
            </div>
            <HelpBlock>{FormattingHelp(transposed)}</HelpBlock>
          </Col>
        </FormGroup>

        {uploadFormat == UploadFormat.File && (
          <FormGroup
            controlId="datafile"
            validationState={
              (showValidation &&
                (uploadFile !== undefined ? "success" : "error")) ||
              null
            }
          >
            <Col componentClass={ControlLabel} sm={3}>
              File
            </Col>
            <Col sm={9}>
              <FormControl
                type="file"
                accept=".csv"
                disabled={taskRunning}
                required
                onChange={(
                  e: React.FormEvent<HTMLInputElement & FormControl>
                ) => {
                  const { files } = e.currentTarget;
                  if (files && files.length > 0) {
                    setUploadFile(files[0]);
                  } else {
                    setUploadFile(undefined);
                  }
                }}
              />
              <HelpBlock>CSV file</HelpBlock>
            </Col>
          </FormGroup>
        )}
        {uploadFormat === UploadFormat.Taiga && (
          <FormGroup
            controlId="taigaId"
            validationState={
              (showValidation && (taigaId !== "" ? "success" : "error")) || null
            }
          >
            <Col componentClass={ControlLabel} sm={3}>
              Taiga ID
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={taigaId}
                required
                disabled={taskRunning}
                onChange={(
                  e: React.FormEvent<HTMLInputElement & FormControl>
                ) => setTaigaId(e.currentTarget.value)}
              />
              <HelpBlock>Taiga NumericMatrixCSV datafile ID</HelpBlock>
            </Col>
          </FormGroup>
        )}

        {isPrivate && (
          <>
            <FormGroup controlId="groupId">
              <Col componentClass={ControlLabel} sm={3}>
                Group
              </Col>
              <Col sm={9}>
                <FormControl
                  componentClass="select"
                  placeholder="select"
                  value={selectedGroup}
                  onChange={(
                    e: React.FormEvent<HTMLSelectElement & FormControl>
                  ) => setSelectedGroup(parseInt(e.currentTarget.value, 10))}
                  required
                  disabled={taskRunning}
                >
                  {groups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {group.displayName}
                    </option>
                  ))}
                </FormControl>
              </Col>
            </FormGroup>
            <FormGroup controlId="dataType">
              <Col componentClass={ControlLabel} sm={3}>
                Data Type
              </Col>
              <Col sm={9}>
                <FormControl
                  componentClass="select"
                  placeholder="select"
                  value={selectedDataType}
                  onChange={(
                    e: React.FormEvent<HTMLSelectElement & FormControl>
                  ) =>
                    setSelectedDataType(e.currentTarget.value as DataTypeEnum)
                  }
                  required
                  disabled={taskRunning}
                >
                  {dataTypes.map((dataType) => (
                    <option key={dataType} value={dataType}>
                      {dataType}
                    </option>
                  ))}
                </FormControl>
              </Col>
            </FormGroup>
          </>
        )}
      </Form>

      {isTransient && (
        <Row>
          <Col componentClass={ControlLabel} sm={3} />
          <Col sm={9}>
            URLs for plotting custom datasets are temporary, and will be deleted
            when the portal is updated.
          </Col>
        </Row>
      )}
      {(taskRunning || uploadTask !== undefined) && submissionResponse && (
        <ProgressTracker
          submissionResponse={submissionResponse}
          onSuccess={onComplete}
          onFailure={onComplete}
          getTaskStatus={getTaskStatus}
        />
      )}

      {uploadTask &&
        uploadTask.state === "SUCCESS" &&
        uploadTask.result.warnings &&
        uploadTask.result.warnings.map((warning: string) => (
          <div key={warning} className="warning-message">
            {warning}
          </div>
        ))}

      {uploadTask && uploadTask.state === "FAILURE" && (
        <Alert bsStyle="danger">Please try again with different inputs.</Alert>
      )}

      <div className="upload-button-container">
        {uploadTask !== undefined && uploadTask.state === "SUCCESS" ? (
          <Button bsStyle="primary" href={uploadTask.result.forwardingUrl}>
            See your dataset
          </Button>
        ) : (
          <Button bsStyle="primary" disabled={taskRunning} onClick={onSubmit}>
            {buttonLabel}
          </Button>
        )}
      </div>
    </>
  );
};

const UserUploadModal = ({
  show,
  onHide,
  uploadFormat,
  isPrivate,
  isTransient,
  taskKickoffFunction,
  groups = [],
  dataTypes = [],
  getTaskStatus,
}: UserUploadModalProps) => {
  const modalTitle = isTransient
    ? `Plot a ${uploadFormat === UploadFormat.File ? "CSV" : "Taiga"} dataset`
    : "Upload private dataset";

  return (
    <Modal show={show} onHide={onHide} dialogClassName="upload-dataset-modal">
      <Modal.Header closeButton>
        <Modal.Title>{modalTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {UploadForm(
          uploadFormat,
          isPrivate,
          isTransient,
          groups,
          dataTypes,
          taskKickoffFunction,
          getTaskStatus
        )}
      </Modal.Body>
    </Modal>
  );
};

export default UserUploadModal;
