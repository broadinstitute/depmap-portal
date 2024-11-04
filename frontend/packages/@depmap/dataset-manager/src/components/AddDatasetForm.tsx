import * as React from "react";
import { useEffect, useState, useRef } from "react";
import {
  FormGroup,
  FormControl,
  ControlLabel,
  Button,
  HelpBlock,
} from "react-bootstrap";
import {
  Dataset,
  DatasetValueType,
  DataType,
  FeatureType,
  Group,
  InvalidPrioritiesByDataType,
  SampleType,
} from "@depmap/types";
import { OptionsType } from "react-select";
import { Option, TagInput } from "@depmap/common-components";
import DatasetMetadataForm from "./DatasetMetadataForm";

interface DatasetFormProps {
  onSubmit: (
    args: any,
    query_args: string[],
    clear_state_callback: (isSuccessfulSubmit: boolean) => void
  ) => void;
  onSubmitDatasetEdit: (
    args: any,
    clear_state_callback: (isSuccessfulSubmit: boolean) => void
  ) => void;
  datasetSubmissionError: string | null;
  getFeatureTypes: () => Promise<FeatureType[]>;
  getSampleTypes: () => Promise<SampleType[]>;
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  getGroups: () => Promise<Group[]>;
  selectedDataset: Dataset | null;
  isEditMode: boolean;
}

interface AllowedValuesInput {
  readonly inputValue: string;
  readonly valueOptions: readonly Option[];
  readonly allowedValues: string[];
}

const initialValues = {
  name: "",
  units: "",
  feature_type: "",
  sample_type: "",
  is_transient: false,
  data_file: "",
  group_id: "",
  value_type: "",
  data_type: "",
  priority: "",
  taiga_id: "",
};

const createOption = (label: string) => ({
  label,
  value: label,
});

export default function DatasetForm(props: DatasetFormProps) {
  const {
    onSubmit,
    onSubmitDatasetEdit,
    datasetSubmissionError,
    getFeatureTypes,
    getDataTypesAndPriorities,
    getSampleTypes,
    getGroups,
    selectedDataset,
    isEditMode,
  } = props;

  const startingValues =
    isEditMode && selectedDataset
      ? {
          id: selectedDataset.id,
          name: selectedDataset.name,
          units: selectedDataset.units,
          feature_type: selectedDataset.feature_type,
          sample_type: selectedDataset.sample_type,
          is_transient: selectedDataset.is_transient,
          data_file: "",
          group_id: selectedDataset.group.id,
          value_type: selectedDataset.value_type,
          data_type: selectedDataset.data_type,
          priority: selectedDataset.priority || "",
          taiga_id: selectedDataset.taiga_id || "",
        }
      : initialValues;

  const [values, setValues] = useState<any>(startingValues);

  const [
    allowedValuesInputOptions,
    setAllowedValuesInputOptions,
  ] = useState<AllowedValuesInput>({
    inputValue: "",
    valueOptions: [],
    allowedValues: [],
  });
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const [featureTypeOptions, setFeatureTypeOptions] = useState<
    FeatureType[] | null
  >(null);
  const [sampleTypeOptions, setSampleTypeOptions] = useState<
    SampleType[] | null
  >(null);
  const [dataTypeOptions, setDataTypeOptions] = useState<DataType[] | null>(
    null
  );
  const [
    invalidPrioritiesByDataType,
    setInvalidPrioritiesByDataType,
  ] = useState<InvalidPrioritiesByDataType>({});
  const [groupOptions, setGroupOptions] = useState<Group[] | null>(null);
  const [initFetchError, setInitFetchError] = useState(false);
  const formElement = useRef<HTMLFormElement | null>(null);

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
        setFeatureTypeOptions(featureTypes);
        setSampleTypeOptions(sampleTypes);
        setGroupOptions(groups);
      } catch (e) {
        console.error(e);
        setInitFetchError(true);
      }
    })();
  }, [getDataTypesAndPriorities, getFeatureTypes, getSampleTypes, getGroups]);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;

    setValues({
      ...values,
      [name]: value,
    });
  };

  const handleFileUpload = (
    e: React.FormEvent<HTMLInputElement & FormControl>
  ) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];

    setValues({
      ...values,
      [e.currentTarget.name]: file === undefined ? "" : file,
    });
  };

  const DatasetValueSelector = () => {
    return (
      <>
        <option key="default" value="">
          --Select--
        </option>
        {Object.values(DatasetValueType).map((val) => {
          return (
            <option key={val} value={val}>
              {val}
            </option>
          );
        })}
      </>
    );
  };

  const TypeSelector = (typeSelectorProps: {
    typeOptions: DataType[] | FeatureType[] | SampleType[] | null;
  }) => {
    const { typeOptions } = typeSelectorProps;
    return (
      <>
        <option key="default" value="">
          --Select--
        </option>
        {typeOptions?.map(({ name }) => {
          return (
            <option key={name} value={name}>
              {name}
            </option>
          );
        })}
      </>
    );
  };

  const GroupSelector = (groupSelectorProps: {
    groupSelectorOptions: Group[] | null;
  }) => {
    const { groupSelectorOptions } = groupSelectorProps;
    return (
      <>
        <option key="default" value="">
          --Select--
        </option>
        {groupSelectorOptions?.map(({ id, name }) => {
          return (
            <option key={id} value={id}>
              {name}
            </option>
          );
        })}
      </>
    );
  };

  const handleAllowedValuesChange = (
    valueAfterAction: OptionsType<Option>
    // actionMeta: ActionMeta<Option>
  ) => {
    // console.log(actionMeta)
    setAllowedValuesInputOptions({
      ...allowedValuesInputOptions,
      /* eslint-disable-next-line no-unneeded-ternary */
      valueOptions: valueAfterAction ? valueAfterAction : [],
      allowedValues: valueAfterAction
        ? valueAfterAction.map((option) => {
            return option.label;
          })
        : [],
    });
  };

  const handleAllowedValuesInputChange = (inputValue: string) => {
    setAllowedValuesInputOptions({
      ...allowedValuesInputOptions,
      inputValue,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!allowedValuesInputOptions.inputValue) return;
    const valuesArray = allowedValuesInputOptions.inputValue
      .split(",")
      .map((option) => option.trim());
    const valueOptions = valuesArray.map((val) => {
      return createOption(val);
    });
    switch (e.key) {
      case "Enter":
      case "Tab":
        setAllowedValuesInputOptions({
          inputValue: "",
          valueOptions: [
            ...allowedValuesInputOptions.valueOptions,
            ...valueOptions,
          ],
          allowedValues: [
            ...allowedValuesInputOptions.allowedValues,
            ...valuesArray,
          ],
        });
        e.preventDefault();
        break;
      default:
        console.log("Unrecognized key pressed");
    }
  };

  const disableSubmit = () => {
    if (!isEditMode) {
      const element = formElement.current;
      if (element !== null) {
        const requiredForms: NodeListOf<HTMLInputElement> = element.querySelectorAll(
          "[required]"
        );

        return [...requiredForms].some((x) => x.value === "");
      }
    }

    return false;
  };

  const validatePrioritySelection = (
    dataType: string,
    priority: number | string
  ) => {
    const currentPriority = Number(priority);
    if (
      dataType === startingValues.data_type &&
      currentPriority === startingValues.priority
    ) {
      return null;
    }

    if (
      invalidPrioritiesByDataType &&
      invalidPrioritiesByDataType[dataType] !== undefined &&
      invalidPrioritiesByDataType[dataType].includes(currentPriority)
    ) {
      return "error";
    }

    return null;
  };

  const clearStateOnSubmit = (
    isSuccessfulSubmit: boolean,
    wasEditing = false
  ) => {
    if (isSuccessfulSubmit) {
      setValues(initialValues);
      setAllowedValuesInputOptions({
        inputValue: "",
        valueOptions: [],
        allowedValues: [],
      });
      if (!wasEditing) {
        const dataFile = document?.getElementById(
          "dataFile"
        ) as HTMLFormElement;
        dataFile.value = "";
      }
    }
    setIsSubmitted(false);
  };

  const handleSubmitButtonClick = () => {
    if (isEditMode) {
      onSubmitDatasetEdit(values, clearStateOnSubmit);
    } else {
      onSubmit(
        values,
        allowedValuesInputOptions.allowedValues,
        clearStateOnSubmit
      );
    }
    setIsSubmitted(true);
  };

  return (
    <>
      {initFetchError ? (
        <p>Failed to fetch data options!</p>
      ) : (
        <form ref={formElement}>
          <p>
            Fill out the fields below to {isEditMode ? " edit" : " add"} your
            dataset!
          </p>
          <FormGroup controlId="name">
            <ControlLabel>Dataset Name</ControlLabel>
            <FormControl
              name="name"
              type="text"
              value={values.name}
              onChange={handleInputChange}
              required
            />
          </FormGroup>
          <FormGroup controlId="valueType">
            <ControlLabel>Value Type</ControlLabel>
            <FormControl
              componentClass="select"
              name="value_type"
              onChange={handleInputChange}
              value={values.value_type}
              disabled={isEditMode}
              required
            >
              <DatasetValueSelector />
            </FormControl>
          </FormGroup>
          <FormGroup
            controlId="priority"
            validationState={validatePrioritySelection(
              values.data_type,
              values.priority
            )}
          >
            <ControlLabel>Priority</ControlLabel>
            <FormControl
              type="number"
              name="priority"
              onChange={handleInputChange}
              value={values.priority || ""}
            />
            <HelpBlock>
              {invalidPrioritiesByDataType &&
                values &&
                values.data_type &&
                invalidPrioritiesByDataType[values.data_type] && (
                  <p>
                    Unavailable priorities are:{" "}
                    {invalidPrioritiesByDataType[values.data_type]
                      .filter((priorityVal) =>
                        values.data_type === startingValues.data_type
                          ? priorityVal !== startingValues.priority
                          : priorityVal
                      )
                      .join(", ")}
                  </p>
                )}
            </HelpBlock>
          </FormGroup>
          <FormGroup controlId="taigaId">
            <ControlLabel>Taiga ID</ControlLabel>
            <FormControl
              type="text"
              name="taiga_id"
              onChange={handleInputChange}
              value={values.taiga_id}
              disabled={isEditMode}
            />
          </FormGroup>
          {values.value_type === "categorical" ? (
            <FormGroup controlId="allowedValues">
              <ControlLabel>Allowed Categorical Values</ControlLabel>
              <TagInput
                inputValue={allowedValuesInputOptions.inputValue}
                value={allowedValuesInputOptions.valueOptions}
                onInputChange={handleAllowedValuesInputChange}
                onChange={handleAllowedValuesChange}
                onKeyDown={handleKeyDown}
                placeholder="Type value or comma-separated values (e.g. val1,val2) and press 'Enter' or 'Tab'"
                isDisabled={values.value_type !== "categorical" || isEditMode}
              />
            </FormGroup>
          ) : null}
          <FormGroup controlId="units">
            <ControlLabel>Units</ControlLabel>
            <FormControl
              name="units"
              type="text"
              value={values.units}
              onChange={handleInputChange}
              required
            />
          </FormGroup>
          <FormGroup controlId="dataType">
            <ControlLabel>Data Type</ControlLabel>
            <FormControl
              name="data_type"
              componentClass="select"
              value={values.data_type}
              onChange={handleInputChange}
              required
            >
              <TypeSelector typeOptions={dataTypeOptions} />
            </FormControl>
          </FormGroup>
          <FormGroup controlId="feature_type">
            <ControlLabel>Feature Type</ControlLabel>
            <FormControl
              name="feature_type"
              componentClass="select"
              value={values.feature_type}
              onChange={handleInputChange}
              disabled={isEditMode}
              required
            >
              <TypeSelector typeOptions={featureTypeOptions} />
            </FormControl>
          </FormGroup>
          <FormGroup controlId="sample_type">
            <ControlLabel>Sample Type</ControlLabel>
            <FormControl
              name="sample_type"
              componentClass="select"
              value={values.sample_type}
              onChange={handleInputChange}
              disabled={isEditMode}
              required
            >
              <TypeSelector typeOptions={sampleTypeOptions} />
            </FormControl>
          </FormGroup>
          <FormGroup controlId="group">
            <ControlLabel>Group</ControlLabel>
            <FormControl
              componentClass="select"
              name="group_id"
              onChange={handleInputChange}
              value={values.group_id}
              required
            >
              <GroupSelector groupSelectorOptions={groupOptions} />
            </FormControl>
          </FormGroup>
          {!isEditMode && (
            <FormGroup controlId="dataFile">
              <ControlLabel>Dataset File</ControlLabel>
              <FormControl
                name="data_file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                required
              />
            </FormGroup>
          )}
          {!isEditMode && (
            <DatasetMetadataForm
              forwardDatasetMetadataDict={(metadataDict: {
                [key: string]: string;
              }) => {
                setValues({
                  ...values,
                  dataset_metadata: { dataset_metadata: metadataDict },
                });
              }}
            />
          )}

          <Button
            disabled={disableSubmit() || isSubmitted}
            onClick={handleSubmitButtonClick}
          >
            Submit
          </Button>
          {isSubmitted ? "  Submitting Dataset..." : ""}
          <p style={{ color: "red" }}>{datasetSubmissionError}</p>
        </form>
      )}
    </>
  );
}
