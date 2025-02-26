import * as React from "react";
import { Label } from "react-bootstrap";
import { TagSelect, TagOption } from "@depmap/common-components";
import { AnnotationType, AnnotationTypingInput } from "@depmap/types";

interface AnnotationTypingSelectorsProps {
  annotationTypesInput: AnnotationTypingInput;
  setAnnotationTypeMapping: (
    selectedOptions: TagOption[] | null,
    annotationType: AnnotationType
  ) => void;
  setAnnotationTypeOptionsCallback: (options: AnnotationTypingInput) => void;
}

export default function AnnotationTypingSelectors({
  annotationTypesInput,
  setAnnotationTypeMapping,
  setAnnotationTypeOptionsCallback,
}: AnnotationTypingSelectorsProps) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
        {annotationTypesInput.remainingOptions.map((option) => (
          <Label bsStyle="info" key={`${option.label}`}>
            {option.label}
          </Label>
        ))}
      </div>
      <p>Continuous</p>
      <TagSelect
        remainingOptions={annotationTypesInput.remainingOptions}
        selectedOptions={annotationTypesInput.selectedContinuousAnnotations}
        placeholder="Select annotations with continous values"
        forwardOptions={(
          selectedOptions: TagOption[] | null,
          remainingOptions: TagOption[]
        ) => {
          setAnnotationTypeOptionsCallback({
            ...annotationTypesInput,
            remainingOptions,
            selectedContinuousAnnotations: selectedOptions,
          });
          setAnnotationTypeMapping(selectedOptions, AnnotationType.continuous);
        }}
      />
      <p>Categorical</p>
      <TagSelect
        remainingOptions={annotationTypesInput.remainingOptions}
        selectedOptions={annotationTypesInput.selectedCategoricalAnnotations}
        placeholder="Select annotations with categorical values"
        forwardOptions={(
          selectedOptions: TagOption[] | null,
          remainingOptions: TagOption[]
        ) => {
          setAnnotationTypeOptionsCallback({
            ...annotationTypesInput,
            remainingOptions,
            selectedCategoricalAnnotations: selectedOptions,
          });
          setAnnotationTypeMapping(selectedOptions, AnnotationType.categorical);
        }}
      />
      <p>Binary</p>
      <TagSelect
        remainingOptions={annotationTypesInput.remainingOptions}
        selectedOptions={annotationTypesInput.selectedBinaryAnnotations}
        placeholder="Select annotations with True/False values"
        forwardOptions={(
          selectedOptions: TagOption[] | null,
          remainingOptions: TagOption[]
        ) => {
          setAnnotationTypeOptionsCallback({
            ...annotationTypesInput,
            remainingOptions,
            selectedBinaryAnnotations: selectedOptions,
          });
          setAnnotationTypeMapping(selectedOptions, AnnotationType.binary);
        }}
      />
      <p>Text</p>
      <TagSelect
        remainingOptions={annotationTypesInput.remainingOptions}
        selectedOptions={annotationTypesInput.selectedTextAnnotations}
        placeholder="Select annotations with text values"
        forwardOptions={(
          selectedOptions: TagOption[] | null,
          remainingOptions: TagOption[]
        ) => {
          setAnnotationTypeOptionsCallback({
            ...annotationTypesInput,
            remainingOptions,
            selectedTextAnnotations: selectedOptions,
          });
          setAnnotationTypeMapping(selectedOptions, AnnotationType.text);
        }}
      />
      <p>String List</p>
      <TagSelect
        remainingOptions={annotationTypesInput.remainingOptions}
        selectedOptions={annotationTypesInput.selectedStringListAnnotations}
        placeholder="Select annotations with values that are a list of strings"
        forwardOptions={(
          selectedOptions: TagOption[] | null,
          remainingOptions: TagOption[]
        ) => {
          setAnnotationTypeOptionsCallback({
            ...annotationTypesInput,
            remainingOptions,
            selectedStringListAnnotations: selectedOptions,
          });
          setAnnotationTypeMapping(
            selectedOptions,
            AnnotationType.list_strings
          );
        }}
      />
    </>
  );
}
