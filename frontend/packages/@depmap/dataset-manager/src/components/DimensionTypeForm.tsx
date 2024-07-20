import * as React from "react";
import { TagOption } from "@depmap/common-components";
import { AnnotationType, AnnotationTypingInput } from "@depmap/types";
import Papa from "papaparse";
import { useRef, useState } from "react";
import {
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
  HelpBlock,
} from "react-bootstrap";
import AnnotationTypingSelectors from "@depmap/annotation-type-selector";

interface DimensionTypeFormProps {
  onSubmit: (
    args: any,
    clearStateCallback: (isSuccessfulSubmit: boolean) => void
  ) => void;
  onSubmitDimensionTypeEdit: (
    args: any,
    clearStateCallback: (isSuccessfulSubmit: boolean) => void
  ) => void;
  dimensionTypeSubmissionError: string | null;
  selectedDimensionType: any | null;
  isEditMode: boolean;
}

export default function DimensionTypeForm(props: DimensionTypeFormProps) {
  const {
    onSubmit,
    onSubmitDimensionTypeEdit,
    dimensionTypeSubmissionError,
    selectedDimensionType,
    isEditMode,
  } = props;

  const initFormValues =
    isEditMode && selectedDimensionType
      ? {
          name: selectedDimensionType.name,
          id_column: selectedDimensionType.id_column,
          axis: selectedDimensionType.axis,
          metadata_file: "",
        }
      : { name: "", id_column: "", axis: "", metadata_file: "" };

  const [formValues, setFormValues] = useState<any>(initFormValues);

  const [
    annotationTypingOptions,
    setAnnotationTypingOptions,
  ] = useState<AnnotationTypingInput>({
    options: [],
    remainingOptions: [],
    selectedContinuousAnnotations: [],
    selectedBinaryAnnotations: [],
    selectedCategoricalAnnotations: [],
    selectedTextAnnotations: [],
    selectedStringListAnnotations: [],
  });
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const formElement = useRef<HTMLFormElement | null>(null);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;

    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  const handleMetadataFileUpload = (
    fileUpload: File,
    setAnnotationTypeOptionsCallback: (options: AnnotationTypingInput) => void
  ) => {
    if (fileUpload !== undefined) {
      Papa.parse(fileUpload, {
        preview: 1,
        beforeFirstChunk() {
          const annotationTypeMapping: { [key: string]: AnnotationType } = {};
          setFormValues({
            ...formValues,
            metadata_file: fileUpload,
            annotation_type_mapping: {
              annotation_type_mapping: annotationTypeMapping,
            },
          });
        },
        complete(results) {
          const columnNames: TagOption[] = results.data[0].map(
            (colName: string) => {
              if (colName === "") {
                throw new Error(
                  "Column must not contain an empty string! CSV must be in tabular format"
                );
              }
              return { label: colName, value: colName };
            }
          );
          setAnnotationTypeOptionsCallback({
            remainingOptions: columnNames,
            options: columnNames,
            selectedContinuousAnnotations: [],
            selectedCategoricalAnnotations: [],
            selectedBinaryAnnotations: [],
            selectedTextAnnotations: [],
            selectedStringListAnnotations: [],
          });
        },
        error(error, file) {
          console.log(error);
          console.log(file);
        },
      });
    } else {
      setAnnotationTypeOptionsCallback({
        options: [],
        remainingOptions: [],
        selectedContinuousAnnotations: [],
        selectedCategoricalAnnotations: [],
        selectedBinaryAnnotations: [],
        selectedTextAnnotations: [],
        selectedStringListAnnotations: [],
      });

      const newValues = { ...formValues, metadata_file: "" };
      delete newValues.annotation_type_mapping;
      setFormValues(newValues);
    }
  };

  const clearStateOnSubmit = (
    isSuccessfulSubmit: boolean,
    wasEditing = false
  ) => {
    if (isSuccessfulSubmit) {
      setFormValues(initFormValues);

      if (!wasEditing) {
        const metadataFile = document?.getElementById(
          "metadataFile"
        ) as HTMLFormElement;
        metadataFile.value = "";
      }
    }
    setIsSubmitted(false);
  };

  const setAnnotationTypeMapping = (
    selectedOptions: TagOption[] | null,
    annotationType: AnnotationType
  ) => {
    if (selectedOptions == null) {
      return;
    }

    setFormValues({
      ...formValues,
      annotation_type_mapping: {
        /* eslint-disable no-param-reassign */
        annotation_type_mapping: selectedOptions.reduce(
          (acc: { [key: string]: AnnotationType }, curVal: TagOption) => {
            acc[curVal.label] = annotationType;
            return acc;
          },
          formValues.annotation_type_mapping.annotation_type_mapping
        ),
      },
    });
  };

  const handleSubmitButtonClick = () => {
    if (isEditMode) {
      onSubmitDimensionTypeEdit(formValues, clearStateOnSubmit);
    } else {
      onSubmit(formValues, clearStateOnSubmit);
    }
    setIsSubmitted(true);
  };

  const disableSubmit = () => {
    if (isEditMode && formValues.metadata_file === "") {
      return true;
    }

    const element = formElement.current;
    const requiredForms:
      | NodeListOf<HTMLInputElement>
      | undefined = element?.querySelectorAll("[required]");
    if (requiredForms) {
      return (
        [...requiredForms].some((x) => x.value === "") ||
        annotationTypingOptions.remainingOptions.length !== 0
      );
    }

    return false;
  };

  return (
    <>
      <form ref={formElement}>
        <p>
          Fill out the fields below to {isEditMode ? " edit" : " add"} your
          dimension type!
        </p>
        <FormGroup controlId="name">
          <ControlLabel>Dimension Type Name</ControlLabel>
          <FormControl
            name="name"
            type="text"
            value={formValues.name}
            onChange={handleInputChange}
            disabled={isEditMode}
            required
          />
        </FormGroup>
        <FormGroup controlId="idColumn">
          <ControlLabel>ID Column</ControlLabel>
          <FormControl
            name="id_column"
            type="text"
            value={formValues.id_column}
            onChange={handleInputChange}
            disabled={isEditMode}
            required
          />
          <HelpBlock>
            <p>
              Identifier name for the dimension type. Ex: For sample type gene,
              the identifier is entrez_id. entrez_id must then be a column in
              the metadata file.
            </p>
          </HelpBlock>
        </FormGroup>
        <FormGroup controlId="dimensionAxis">
          <ControlLabel>Dimension Axis</ControlLabel>
          <FormControl
            name="axis"
            componentClass="select"
            value={formValues.axis}
            onChange={handleInputChange}
            disabled={isEditMode}
            required
          >
            <option key="default" value="">
              --Select--
            </option>
            <option key="feature" value="feature">
              Feature
            </option>
            <option key="sample" value="sample">
              Sample
            </option>
          </FormControl>
          <HelpBlock>
            <p>
              Dimensions are either feature or sample. When used in a matrix
              dataset, features are oriented as columns and samples are oriented
              as rows.
            </p>
          </HelpBlock>
        </FormGroup>
        <FormGroup controlId="metadataFile">
          <ControlLabel>Dimension Type Metadata File</ControlLabel>
          <FormControl
            name="metadata_file"
            type="file"
            accept=".csv"
            onChange={(e: React.FormEvent<HTMLInputElement & FormControl>) => {
              const target = e.target as HTMLInputElement;
              const file = target.files?.[0];
              if (file) {
                handleMetadataFileUpload(file, setAnnotationTypingOptions);
              } else {
                setFormValues({ ...formValues, metadata_file: "" });
              }
            }}
          />
          {formValues.metadata_file !== "" ? (
            <AnnotationTypingSelectors
              annotationTypesInput={{ ...annotationTypingOptions }}
              setAnnotationTypeMapping={setAnnotationTypeMapping}
              setAnnotationTypeOptionsCallback={setAnnotationTypingOptions}
            />
          ) : null}
        </FormGroup>
        <Button
          disabled={disableSubmit() || isSubmitted}
          onClick={handleSubmitButtonClick}
        >
          Submit
        </Button>
        {isSubmitted ? "  Submitting Dimension Type..." : ""}
        <p style={{ color: "red" }}>{dimensionTypeSubmissionError}</p>
      </form>
    </>
  );
}
