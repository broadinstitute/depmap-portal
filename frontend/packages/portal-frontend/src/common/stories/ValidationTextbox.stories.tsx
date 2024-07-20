import * as React from "react";
import { ValidationTextbox } from "@depmap/data-slicer";

export default {
  title: "Components/Common/ValidationTextbox",
  component: ValidationTextbox,
};

const hardCodedValidGeneLabels: Set<string> = new Set([
  "SOX10",
  "AMY1A",
  "ANOS1",
  "MED1",
  "SWI5",
  "F8A1",
  "HNF1B",
  "MAP4K4",
]);

const validationFunction = (inputs: string[]) => {
  const valid: Set<string> = new Set();
  const invalid: Set<string> = new Set();
  inputs.forEach((input: string) => {
    if (hardCodedValidGeneLabels.has(input)) {
      valid.add(input);
    } else {
      invalid.add(input);
    }
  });
  return Promise.resolve({
    valid,
    invalid,
  });
};

export const PassInAListOfValidInputs = () => (
  <ValidationTextbox
    placeholderText="Begin typing your space-separated list here"
    validValues={hardCodedValidGeneLabels}
    onInvalidInputsExist={(invalidInputs: Set<string>) => {
      console.log(invalidInputs);
    }}
    onAllInputsValidated={(validInputs: Set<string>) => {
      console.log("Yeehaw my dudes");
    }}
  />
);

export const UseAValidationFunction = () => (
  <ValidationTextbox
    placeholderText="Begin typing your space-separated list here"
    validationFunction={validationFunction}
    onInvalidInputsExist={(invalidInputs: Set<string>) => {
      console.log(invalidInputs);
    }}
    onAllInputsValidated={(validInputs: Set<string>) => {
      console.log("Yeehaw my dudes");
    }}
  />
);
