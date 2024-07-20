/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as React from "react";
import { MatrixDatasetForm } from "./MatrixDatasetForm";
import { TableDatasetForm } from "./TableDatasetForm";
import { FormGroup, Radio } from "react-bootstrap";
import { useState, useEffect, useMemo } from "react";
import { matrixFormSchema } from "../models/matrixDatasetFormSchema";
import { tableFormSchema } from "../models/tableDatasetFormSchema";
import {
  DatasetParams,
  DataType,
  FeatureType,
  Group,
  InvalidPrioritiesByDataType,
  SampleType,
  UploadFileResponse,
} from "@depmap/types";
import ChunkedFileUploader from "./ChunkedFileUploader";

const initDatasetForm = (format: "table" | "matrix") => {
  const initForm: { [key: string]: any } = {};
  if (format === "matrix") {
    Object.keys(matrixFormSchema.properties)
      .concat("allowed_values")
      .forEach((key) => {
        if (
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
};

interface DatasetFormProps {
  // onSubmitDatasetEdit: (
  //   args: any,
  //   clear_state_callback: (isSuccessfulSubmit: boolean) => void
  // ) => void;
  // datasetSubmissionError: string | null;
  getFeatureTypes: () => Promise<FeatureType[]>;
  getSampleTypes: () => Promise<SampleType[]>;
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  getGroups: () => Promise<Group[]>;
  uploadFile: (fileArgs: { file: File | Blob }) => Promise<UploadFileResponse>;
  uploadDataset: (datasetParams: DatasetParams) => Promise<any>;
  // selectedDataset: Dataset | null;
  // isEditMode: boolean;
}

export default function DatasetForm(props: DatasetFormProps) {
  const {
    getFeatureTypes,
    getSampleTypes,
    getGroups,
    getDataTypesAndPriorities,
    uploadFile,
    uploadDataset,
  } = props;
  const [selectedFormat, setSelectedFormat] = useState<
    "matrix" | "table" | null
  >(null);
  const [formContent, setFormContent] = useState({
    table: initDatasetForm("table"),
    matrix: initDatasetForm("matrix"),
  });

  const [fileIds, setFileIds] = useState<string[] | null>(null);
  const [md5Hash, setMD5Hash] = useState<string | null>(null);

  const [featureTypeOptions, setFeatureTypesOptions] = useState<FeatureType[]>(
    []
  );
  const [sampleTypeOptions, setSampleTypesOptions] = useState<SampleType[]>([]);
  const [groupOptions, setGroupsOptions] = useState<Group[]>([]);
  const [
    invalidPrioritiesByDataType,
    setInvalidPrioritiesByDataType,
  ] = useState<InvalidPrioritiesByDataType>({});
  const [dataTypeOptions, setDataTypeOptions] = useState<DataType[]>([]);
  console.log(selectedFormat);
  console.log(formContent);

  useEffect(() => {
    (async () => {
      try {
        const [
          dataTypesPriorities,
          featureTypes,
          sampleTypes,
          groups,
        ] = await Promise.all([
          getDataTypesAndPriorities(),
          getFeatureTypes(),
          getSampleTypes(),
          getGroups(),
        ]);

        const dataTypes = Object.keys(dataTypesPriorities).map((dType) => {
          return {
            name: dType,
          };
        });
        setInvalidPrioritiesByDataType(dataTypesPriorities);
        setDataTypeOptions(dataTypes);
        setFeatureTypesOptions(featureTypes);
        setSampleTypesOptions(sampleTypes);
        setGroupsOptions(groups);
      } catch (e) {
        console.error(e);
        // setInitFetchError(true);
      }
    })();
  }, [getFeatureTypes, getSampleTypes, getGroups, getDataTypesAndPriorities]);

  const formComponent = useMemo(() => {
    const onSubmitForm = (formData: { [key: string]: any }) => {
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
      uploadDataset(formToSubmit as DatasetParams);
    };

    if (selectedFormat === "matrix") {
      return (
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
        />
      );
    }
    if (selectedFormat === "table") {
      return (
        <TableDatasetForm
          featureTypes={featureTypeOptions}
          sampleTypes={sampleTypeOptions}
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
      );
    }

    return null;
  }, [
    selectedFormat,
    uploadDataset,
    featureTypeOptions,
    sampleTypeOptions,
    groupOptions,
    dataTypeOptions,
    invalidPrioritiesByDataType,
    formContent,
    fileIds,
    md5Hash,
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
      <legend>Step 1: Upload A File</legend>
      <ChunkedFileUploader
        uploadFile={uploadFile}
        forwardFileIdsAndHash={forwardFileIdsAndHash}
      />
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
        <Radio name="radioGroup" inline onChange={handleOnChange} value="table">
          Table
        </Radio>
      </FormGroup>
      {formComponent ? (
        <legend>Step 3: Fill Out Dataset Information</legend>
      ) : null}
      {formComponent}
    </>
  );
}
