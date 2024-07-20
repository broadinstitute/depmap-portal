import * as React from "react";
import { useState, useRef } from "react";
import { FormGroup, FormControl, ControlLabel, Button } from "react-bootstrap";
import { TagOption } from "@depmap/common-components";
import { AnnotationType, AnnotationTypingInput } from "@depmap/types";
import Papa from "papaparse";
import AnnotationTypingSelections from "@depmap/annotation-type-selector";

interface TypeProps {
  onSubmit: (
    args: any,
    clear_state_callback: (isSuccessfulSubmit: boolean) => void
  ) => void;
  submissionError: string | null;
  /** Boolean denoting whether the form intention is to edit an existing metadataType or add a new metadataType */
  isTypeEdit: boolean;
  initialValues: { name: string; id_column: string; metadata_file: "" | File };
}

export default function TypeForm(props: TypeProps) {
  const { onSubmit, submissionError, isTypeEdit, initialValues } = props;
  const [values, setValues] = useState<any>(initialValues);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [
    annotationTypingOptions,
    setAnnotationTypingOptions,
  ] = useState<AnnotationTypingInput>({
    options: [],
    remainingOptions: [],
    selectedContinuousAnnotations: [],
    selectedCategoricalAnnotations: [],
    selectedBinaryAnnotations: [],
    selectedTextAnnotations: [],
    selectedStringListAnnotations: [],
  });
  const formElement = useRef<HTMLFormElement | null>(null);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setValues({
      ...values,
      [name]: value,
    });
  };

  const clearStateOnSubmit = (isSuccessfulSubmit: boolean) => {
    if (isSuccessfulSubmit) {
      setValues(initialValues);
      const dataFile = document?.getElementById(
        "metadataFile"
      ) as HTMLFormElement;
      dataFile.value = "";
    }
    setIsSubmitted(false);
  };

  const handleMetadataFileUpload = (
    e: React.FormEvent<HTMLInputElement & FormControl>
  ) => {
    const target = e.target as HTMLInputElement;
    const fileUpload = target.files?.[0];

    if (fileUpload != null) {
      Papa.parse(fileUpload, {
        preview: 1,
        beforeFirstChunk() {
          const annotationTypeMapping: { [key: string]: AnnotationType } = {};
          setValues({
            ...values,
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
          setAnnotationTypingOptions({
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
      setAnnotationTypingOptions({
        options: [],
        remainingOptions: [],
        selectedContinuousAnnotations: [],
        selectedCategoricalAnnotations: [],
        selectedBinaryAnnotations: [],
        selectedTextAnnotations: [],
        selectedStringListAnnotations: [],
      });
      const newValues = (({ annotation_type_mapping, ...rest }) => {
        return {
          ...rest,
          [e.currentTarget.name]: fileUpload,
        };
      })(values);

      setValues(newValues);
    }
  };

  const setAnnotationTypeMapping = (
    selectedOptions: TagOption[] | null,
    annotationType: AnnotationType
  ) => {
    if (selectedOptions == null) {
      return;
    }

    setValues({
      ...values,
      annotation_type_mapping: {
        annotation_type_mapping: selectedOptions.reduce(
          (acc: { [key: string]: AnnotationType }, curVal: TagOption) => {
            acc[curVal.label] = annotationType;
            return acc;
          },
          values.annotation_type_mapping.annotation_type_mapping
        ),
      },
    });
  };

  const disableSubmit = () => {
    const element = formElement.current;
    if (element !== null) {
      const requiredForms: NodeListOf<HTMLInputElement> = element.querySelectorAll(
        "[required]"
      );

      return (
        [...requiredForms].some((x) => x.value === "") ||
        annotationTypingOptions.remainingOptions.length !== 0
      );
    }

    return null;
  };

  return (
    <>
      <form ref={formElement}>
        <FormGroup controlId="name">
          <ControlLabel>Name</ControlLabel>
          <FormControl
            name="name"
            type="text"
            value={values.name}
            onChange={handleInputChange}
            disabled={isTypeEdit}
            required
          />
        </FormGroup>
        <FormGroup controlId="idValue">
          <ControlLabel>Identifier</ControlLabel>
          <FormControl
            name="id_column"
            type="text"
            value={values.id_column}
            onChange={handleInputChange}
            disabled={isTypeEdit}
            required
          />
        </FormGroup>
        <FormGroup controlId="metadataFile">
          <ControlLabel>
            Metadata File <i>(Optional)</i>
          </ControlLabel>
          <FormControl
            name="metadata_file"
            type="file"
            accept=".csv"
            onChange={(e: React.FormEvent<HTMLInputElement & FormControl>) => {
              handleMetadataFileUpload(e);
            }}
            required={isTypeEdit}
          />
          {values.metadata_file !== "" ? (
            <AnnotationTypingSelections
              annotationTypesInput={{ ...annotationTypingOptions }}
              setAnnotationTypeMapping={setAnnotationTypeMapping}
              setAnnotationTypeOptionsCallback={setAnnotationTypingOptions}
            />
          ) : null}
        </FormGroup>
        <Button
          disabled={disableSubmit() || isSubmitted}
          onClick={() => {
            onSubmit(values, clearStateOnSubmit);
            setIsSubmitted(true);
          }}
        >
          Submit
        </Button>
        {isSubmitted ? "  Submitting Type..." : ""}
        <p style={{ color: "red" }}>{submissionError}</p>
      </form>
    </>
  );
}
