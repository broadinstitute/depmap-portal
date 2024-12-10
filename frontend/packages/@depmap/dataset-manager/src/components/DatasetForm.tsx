/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as React from "react";
import { MatrixDatasetForm } from "./MatrixDatasetForm";
import { TableDatasetForm } from "./TableDatasetForm";
import { FormGroup, Radio } from "react-bootstrap";
import { useState, useEffect, useMemo, useCallback } from "react";
import { matrixFormSchema } from "../models/matrixDatasetFormSchema";
import { tableFormSchema } from "../models/tableDatasetFormSchema";
import {
  DatasetParams,
  DataType,
  Group,
  InvalidPrioritiesByDataType,
  UploadFileResponse,
  DimensionType,
  SampleDimensionType,
  FeatureDimensionType,
  Dataset,
} from "@depmap/types";
import ChunkedFileUploader from "./ChunkedFileUploader";
import { CeleryTask } from "@depmap/compute";
import progressTrackerStyles from "@depmap/common-components/src/styles/ProgressTracker.scss";

interface DatasetFormProps {
  getDimensionTypes: () => Promise<DimensionType[]>;
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  getGroups: () => Promise<Group[]>;
  uploadFile: (fileArgs: { file: File | Blob }) => Promise<UploadFileResponse>;
  uploadDataset: (datasetParams: DatasetParams) => Promise<any>;
  getTaskStatus: (taskIds: string) => Promise<CeleryTask>;
  onSuccess: (dataset: Dataset) => void;
  isAdvancedMode: boolean;
}

export default function DatasetForm(props: DatasetFormProps) {
  const {
    getDimensionTypes,
    getGroups,
    getDataTypesAndPriorities,
    uploadFile,
    uploadDataset,
    getTaskStatus,
    onSuccess,
    isAdvancedMode,
  } = props;

  const initDatasetForm = React.useCallback(
    (format: "table" | "matrix") => {
      const initForm: { [key: string]: any } = {};
      if (format === "matrix") {
        Object.keys(matrixFormSchema.properties)
          .concat("allowed_values")
          .forEach((key) => {
            if (!isAdvancedMode && key === "value_type") {
              initForm[key] = "continuous";
            } else if (
              typeof matrixFormSchema.properties[key] === "object" &&
              // @ts-ignore
              "default" in matrixFormSchema.properties[key]
            ) {
              // @ts-ignore
              initForm[key] = matrixFormSchema.properties[key].default;
            } else {
              initForm[key] = null;
            }
          });
        return initForm;
      }
      if (format === "table") {
        Object.keys(tableFormSchema.properties).forEach((key) => {
          if (
            typeof tableFormSchema.properties[key] === "object" &&
            // @ts-ignore
            "default" in tableFormSchema.properties[key]
          ) {
            // @ts-ignore
            initForm[key] = tableFormSchema.properties[key].default;
          } else {
            initForm[key] = null;
          }
        });
        return initForm;
      }
      return initForm;
    },
    [isAdvancedMode]
  );

  const [selectedFormat, setSelectedFormat] = useState<
    "matrix" | "table" | null
  >(isAdvancedMode ? null : "matrix");
  const [formContent, setFormContent] = useState({
    table: initDatasetForm("table"),
    matrix: initDatasetForm("matrix"),
  });

  const [fileIds, setFileIds] = useState<string[] | null>(null);
  const [md5Hash, setMD5Hash] = useState<string | null>(null);

  const [featureTypeOptions, setFeatureTypesOptions] = useState<
    FeatureDimensionType[]
  >([]);
  const [sampleTypeOptions, setSampleTypesOptions] = useState<
    SampleDimensionType[]
  >([]);
  const [groupOptions, setGroupsOptions] = useState<Group[]>([]);
  const [
    invalidPrioritiesByDataType,
    setInvalidPrioritiesByDataType,
  ] = useState<InvalidPrioritiesByDataType>({});
  const [dataTypeOptions, setDataTypeOptions] = useState<DataType[]>([]);
  const [isTaskRunning, setIsTaskRunning] = React.useState(false);
  // Completed task (either failed or successful)
  const [completedTask, setCompletedTask] = React.useState<
    CeleryTask | undefined
  >(undefined);

  console.log(selectedFormat);
  console.log(formContent);

  useEffect(() => {
    (async () => {
      try {
        const [
          dataTypesPriorities,
          dimensionTypes,
          groups,
        ] = await Promise.all([
          getDataTypesAndPriorities(),
          getDimensionTypes(),
          getGroups(),
        ]);

        const dataTypes = Object.keys(dataTypesPriorities).map((dType) => {
          return {
            name: dType,
          };
        });
        const sampleTypes: SampleDimensionType[] = [];
        const featureTypes: FeatureDimensionType[] = [];
        dimensionTypes.map((dt: FeatureDimensionType | SampleDimensionType) =>
          dt.axis === "sample" ? sampleTypes.push(dt) : featureTypes.push(dt)
        );

        setInvalidPrioritiesByDataType(dataTypesPriorities);
        setDataTypeOptions(dataTypes);
        setFeatureTypesOptions(featureTypes);
        setSampleTypesOptions(sampleTypes);
        setGroupsOptions(groups);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [getDimensionTypes, getGroups, getDataTypesAndPriorities]);

  /**
    checkStatus and reject functions influenced by ProgressTracker.tsx

    For normal, expected user input errors, the back end returns 200 with state failure
    Caught errors still return 200 in task poll but task state reflects failure
    For unexpected failure modes, the back end returns 500. This is so that the error gets sent to stackdriver
    For these unexpected errors, we catch the 500, and mimic the response from a failed-gracefully-with-200
  */
  const reject = useCallback((res: any) => {
    const isCeleryTask = (x: any): x is CeleryTask => x.state !== undefined;
    if (!isCeleryTask(res)) {
      setCompletedTask({
        id: "",
        state: "FAILURE",
        percentComplete: undefined,
        message:
          "Unexpected error. If you get this error consistently, please contact us with a screenshot and the actions that lead to this error.",
        result: null,
      });
    } else {
      setCompletedTask(res);
    }
    setIsTaskRunning(false);
  }, []);

  const checkStatus = useCallback(
    (response: CeleryTask) => {
      console.log("Polled Response", response);
      const later = (delay: number): Promise<any> => {
        return new Promise((res) => {
          setTimeout(res, delay);
        });
      };

      if (response.state === "SUCCESS") {
        setIsTaskRunning(false);
        setCompletedTask(response);
        onSuccess(response.result.dataset);
      } else if (response.state === "FAILURE") {
        setIsTaskRunning(false);
        setCompletedTask(response);
      } else {
        const nextPollDelay = response.nextPollDelay;
        later(nextPollDelay || 0)
          .then(() => {
            return getTaskStatus(response.id);
          })
          .then(checkStatus, reject);
      }
    },
    [getTaskStatus, onSuccess, reject]
  );

  const submissionMessage = useMemo(() => {
    if (completedTask?.state === "SUCCESS" && !isTaskRunning) {
      return (
        <div>
          <div style={{ color: "green" }}>SUCCESS!</div>
          {completedTask.result.unknownIDs.length > 0 ? (
            <div style={{ color: "goldenrod" }}>
              WARNING: Unknown IDS:{" "}
              {JSON.parse(completedTask.result.unknownIDs)}
            </div>
          ) : null}
        </div>
      );
    }
    if (completedTask?.state === "FAILURE" && !isTaskRunning) {
      return (
        <div style={{ color: "red" }}>FAILED: {completedTask.message}!</div>
      );
    }
    if (isTaskRunning) {
      return (
        <div className={progressTrackerStyles.loadingEllipsis}>LOADING</div>
      );
    }
    return null;
  }, [isTaskRunning, completedTask]);

  const formComponent = useMemo(() => {
    const onSubmitForm = async (formData: { [key: string]: any }) => {
      // TODO: add callback to clear form? and try catch?
      let formToSubmit = { ...formData };
      if (
        "columns_metadata" in formData &&
        typeof formData.columns_metadata == "string"
      ) {
        // on submit, string val for columns_metadata should already be validated if it can be parsed into JSON in TableDatasetForm
        const columnsMetadataParsed = JSON.parse(formData.columns_metadata);
        formToSubmit = {
          ...formToSubmit,
          columns_metadata: columnsMetadataParsed,
        };
      }
      console.log("form submitted: ", formToSubmit);

      setCompletedTask(undefined);
      setIsTaskRunning(true);
      uploadDataset(formToSubmit as DatasetParams).then(checkStatus, reject);
    };

    if (selectedFormat === "matrix") {
      return (
        <>
          <MatrixDatasetForm
            featureTypes={featureTypeOptions}
            sampleTypes={sampleTypeOptions}
            groups={groupOptions}
            dataTypes={dataTypeOptions}
            invalidDataTypePriorities={invalidPrioritiesByDataType}
            initFormData={formContent.matrix}
            fileIds={fileIds}
            md5Hash={md5Hash}
            forwardFormData={(formData: { [key: string]: string }) => {
              setFormContent({
                ...formContent,
                matrix: formData,
              });
            }}
            onSubmitForm={onSubmitForm}
            isAdvancedMode={isAdvancedMode}
          />
          {submissionMessage}
        </>
      );
    }
    if (selectedFormat === "table") {
      const dimensionTypeOptions: DimensionType[] = (featureTypeOptions as DimensionType[]).concat(
        sampleTypeOptions
      );
      return (
        <>
          <TableDatasetForm
            dimensionTypes={dimensionTypeOptions}
            groups={groupOptions}
            dataTypes={dataTypeOptions}
            invalidDataTypePriorities={invalidPrioritiesByDataType}
            initFormData={formContent.table}
            fileIds={fileIds}
            md5Hash={md5Hash}
            forwardFormData={(formData: { [key: string]: string }) => {
              setFormContent({
                ...formContent,
                table: formData,
              });
            }}
            onSubmitForm={onSubmitForm}
          />
          {submissionMessage}
        </>
      );
    }

    return null;
  }, [
    selectedFormat,
    uploadDataset,
    checkStatus,
    reject,
    featureTypeOptions,
    sampleTypeOptions,
    groupOptions,
    dataTypeOptions,
    invalidPrioritiesByDataType,
    formContent,
    fileIds,
    md5Hash,
    isAdvancedMode,
    submissionMessage,
  ]);

  const handleOnChange = (e: any) => {
    const value = e.target.value;
    console.log(value);
    setSelectedFormat(value);
  };

  const forwardFileIdsAndHash = (
    forwardedFileIds: Array<string> | null,
    hash: string | null
  ) => {
    setFileIds(forwardedFileIds);
    setMD5Hash(hash);
    console.log(forwardedFileIds, hash);
    setFormContent({
      ...formContent,
      table: {
        ...formContent.table,
        file_ids: forwardedFileIds,
        dataset_md5: hash,
      },
      matrix: {
        ...formContent.matrix,
        file_ids: forwardedFileIds,
        dataset_md5: hash,
      },
    });
  };

  return (
    <>
      <div>
        <legend>Step 1: Upload A File</legend>
        <ChunkedFileUploader
          uploadFile={uploadFile}
          forwardFileIdsAndHash={forwardFileIdsAndHash}
        />
      </div>

      {isAdvancedMode ? (
        <div>
          <legend>Step 2: Choose Dataset Format</legend>
          <FormGroup controlId="format" required>
            <Radio
              name="radioGroup"
              inline
              onChange={handleOnChange}
              value="matrix"
            >
              Matrix
            </Radio>
            <Radio
              name="radioGroup"
              inline
              onChange={handleOnChange}
              value="table"
            >
              Table
            </Radio>
          </FormGroup>
        </div>
      ) : null}

      {formComponent ? (
        <legend>
          {isAdvancedMode ? "Step 3:" : "Step 2:"} Fill Out Dataset Information
        </legend>
      ) : null}
      {formComponent}
    </>
  );
}
