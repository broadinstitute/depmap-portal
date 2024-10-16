import * as React from "react";
import { useState } from "react";
import { FormGroup, ControlLabel, HelpBlock } from "react-bootstrap";

import { ActionMeta, ValueType } from "react-select";
import { TagInput, Option } from "@depmap/common-components";
import { FieldProps } from "@rjsf/utils";

interface DatasetMetadataFormProps {
  forwardDatasetMetadataDict?: (metadataDict: {
    [key: string]: string;
  }) => void;
  initDatasetMetadata?: { [key: string]: string } | null;
}

export default function DatasetMetadataForm({
  forwardDatasetMetadataDict = undefined,
  initDatasetMetadata = undefined,
}: DatasetMetadataFormProps) {
  let initMetadataValues: string[] = [];
  if (initDatasetMetadata != null) {
    initMetadataValues = Object.entries(initDatasetMetadata).map(
      ([key, value]) => {
        return `${key}:${value}`;
      }
    );
  }

  const createOption = (label: string) => ({
    label,
    value: label,
  });
  const initValueOptions = initMetadataValues.map((vals) => createOption(vals));

  const [inputValue, setInputValue] = useState<string>("");
  const [valueOptions, setValueOptions] = useState<Option[]>(initValueOptions);
  const [metadataValues, setMetadataValues] = useState<string[]>(
    initMetadataValues
  );
  const [validValues, setValidValues] = useState<Set<string>>(new Set());
  const [invalidValues, setInvalidValues] = useState<Set<string>>(new Set());
  const [, setMetadata] = useState({});

  const validateMetadata = (inputs: string[]) => {
    const valid: Set<string> = new Set();
    const invalid: Set<string> = new Set();
    const existingKeys: Set<string> = new Set();
    inputs.forEach((input: string) => {
      if (
        input.includes(":") &&
        !input.endsWith(":") &&
        !input.startsWith(":") &&
        !input.endsWith(" ") &&
        !input.startsWith(" ") &&
        input.match(/:/gi)?.length === 1
      ) {
        // strip whitespace between colon
        const strippedInput = input.replace(/\s*(:)\s*/gi, ":");

        // If key exists already, then input is not valid
        const matchedKey = strippedInput.match(/^[^:]+/gi);

        const key = matchedKey !== null ? matchedKey[0] : null;

        if (key === null) {
          invalid.add(strippedInput);
        } else if (!existingKeys.has(key)) {
          existingKeys.add(key);
          valid.add(strippedInput);
        } else if (existingKeys.has(key)) {
          invalid.add(strippedInput);
        }
      } else {
        invalid.add(input);
      }
    });
    setValidValues(valid);
    setInvalidValues(invalid);
    const metadataDict: { [key: string]: string } = {};
    valid.forEach((input) => {
      const keyValueArray = input.split(":");
      const key = keyValueArray[0];
      const value = keyValueArray[1];
      metadataDict[key] = value;
    });

    setMetadata(metadataDict);
    if (forwardDatasetMetadataDict !== undefined) {
      forwardDatasetMetadataDict(metadataDict);
    }

    return Promise.resolve({
      valid,
      invalid,
    });
  };

  const handleInputValueChange = (inputVal: string) => {
    setInputValue(inputVal);
  };

  const handleChange = (
    valueAfterAction: ValueType<Option, true>,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    actionMeta: ActionMeta<Option>
  ) => {
    setValueOptions(valueAfterAction ? (valueAfterAction as Option[]) : []);
    const newMetdataValues = valueAfterAction
      ? valueAfterAction.map((option) => {
          return option.label;
        })
      : [];
    validateMetadata(newMetdataValues);
    setMetadataValues(newMetdataValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!inputValue) return;
    const valuesArray = inputValue.split(",").map((option) => option.trim());
    const newValueOptions = valuesArray.map((val) => {
      return createOption(val);
    });
    switch (e.key) {
      case "Enter":
      case "Tab": {
        setInputValue("");
        const newMetdataValues = [...metadataValues, ...valuesArray];
        validateMetadata(newMetdataValues);
        setMetadataValues(newMetdataValues);
        setValueOptions([...valueOptions, ...newValueOptions]);
        e.preventDefault();
        break;
      }
      default:
        console.log("Unrecognized key pressed");
    }
  };

  const getMetadataValidationState = () => {
    if (invalidValues.size === 0) {
      return "success";
    }
    if (invalidValues.size > 0) {
      return "error";
    }
    return null;
  };

  const postValidationDisplay: any[] = [];
  if (invalidValues.size > 0) {
    postValidationDisplay.push(
      <div
        key="warning"
        style={{
          borderRadius: "5px",
          paddingLeft: "8px",
          paddingRight: "8px",
          margin: "2px",
          backgroundColor: "firebrick",
          color: "white",
        }}
      >
        <span
          className="glyphicon glyphicon-exclamation-sign"
          aria-hidden="true"
          style={{ paddingRight: "2px" }}
        />{" "}
        Invalid Inputs
      </div>
    );

    invalidValues.forEach((invalidInput: string) => {
      postValidationDisplay.push(
        <div
          key={invalidInput}
          aria-hidden="true"
          onClick={() => {
            const valuesAfterRemove = valueOptions.filter(
              (option: Option) => option.label !== invalidInput
            );
            const action = {
              action: "remove-value",
              removedValue: {
                label: invalidInput,
                value: invalidInput,
              },
            };
            handleChange(valuesAfterRemove, action as ActionMeta<Option>);
          }}
          style={{
            borderRadius: "5px",
            paddingLeft: "8px",
            paddingRight: "8px",
            margin: "2px",
            backgroundColor: "gainsboro",
            color: "grey",
            cursor: "pointer",
          }}
        >
          <span
            className="glyphicon glyphicon-remove-sign"
            aria-hidden="true"
            style={{ paddingRight: "2px" }}
          />{" "}
          {invalidInput}
        </div>
      );
    });
  } else if (validValues.size > 0) {
    postValidationDisplay.push(
      <div
        key="warning"
        style={{
          borderRadius: "5px",
          paddingLeft: "8px",
          paddingRight: "8px",
          margin: "2px",
          backgroundColor: "forestgreen",
          color: "white",
        }}
      >
        <span
          className="glyphicon glyphicon-ok"
          aria-hidden="true"
          style={{ paddingRight: "2px" }}
        />{" "}
        All Inputs Valid
      </div>
    );
  }

  return (
    <>
      <FormGroup
        controlId="formControlsTextarea"
        validationState={
          metadataValues.length > 0 ? getMetadataValidationState() : null
        }
      >
        <ControlLabel>Metadata</ControlLabel>
        <TagInput
          inputValue={inputValue}
          value={valueOptions}
          onInputChange={handleInputValueChange}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter comma-separated key:value pairs"
          isDisabled={false}
        />
        <div
          style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}
        >
          {postValidationDisplay}
        </div>
        <HelpBlock>Metadata must be in key:value format</HelpBlock>
      </FormGroup>
    </>
  );
}

/*
CustomDatasetMetadata component is a wrapper for DatasetMetadataForm and is used as a custom RJSF field component for dataset metadata
*/
export const CustomDatasetMetadata = function (props: FieldProps) {
  const { onChange, formData } = props;

  return (
    <div id="customDatasetMetadata">
      <DatasetMetadataForm
        initDatasetMetadata={formData}
        forwardDatasetMetadataDict={(metadataDict: {
          [key: string]: string;
        }) => {
          onChange(metadataDict);
        }}
      />
    </div>
  );
};
