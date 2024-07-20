import * as React from "react";
import { useState } from "react";
import {
  Button,
  Col,
  Form,
  FormControl,
  FormGroup,
  HelpBlock,
  Row,
} from "react-bootstrap";
import { ValueType } from "react-select";
import { TagInput, Option } from "@depmap/common-components";
import WideTable from "@depmap/wide-table";
import { AccessType, Group, GroupEntry, GroupEntryArgs } from "@depmap/types";
import styles from "../styles/styles.scss";

interface AddGroupEntryFormProps {
  group: Group;
  addGroupEntries: (
    groupId: string,
    groupEntryArgs: GroupEntryArgs[],
    addGroupEntriesStateCallback: (
      addedGroupEntries: string[],
      newGroupEntries: GroupEntry[]
    ) => void
  ) => void;
  updateGroupEntriesAccess: (
    groupId: string,
    groupEntryIds: Set<string>,
    accessEdit: string,
    updatedGroupEntriesStateCallback: (
      selectedGroupEntries: Set<string>,
      newGroupEntries: GroupEntry[]
    ) => void
  ) => void;
  groupEntryErrors?: {
    addGroupEntryError: string | null;
    updateGroupEntryError: string | null;
  };
}

interface EmailEntriesInput {
  readonly inputValue: string;
  readonly valueOptions: readonly Option[];
  readonly emailEntries: string[];
}

function AddGroupEntryForm({
  group,
  addGroupEntries,
  updateGroupEntriesAccess,
  groupEntryErrors = {
    addGroupEntryError: null,
    updateGroupEntryError: null,
  },
}: AddGroupEntryFormProps) {
  const [
    emailEntriesOptions,
    setEmailEntriesOptions,
  ] = useState<EmailEntriesInput>({
    inputValue: "",
    valueOptions: [],
    emailEntries: [],
  });
  const [selectedGroupEntries, setSelectedGroupEntries] = useState<Set<string>>(
    new Set()
  );
  const [selectedAccessType, setSelectedAccessType] = useState("");
  const [groupEntryTableData, setGroupEntryTableData] = useState<GroupEntry[]>(
    group.group_entries.map((g) => {
      return { ...g, isChecked: false };
    })
  );

  const handleEmailEntriesChange = (
    valueAfterAction: ValueType<Option, true>
    // actionMeta: ActionMeta<Option>
  ) => {
    // console.log(actionMeta)
    setEmailEntriesOptions({
      ...emailEntriesOptions,
      /* eslint-disable-next-line no-unneeded-ternary */
      valueOptions: valueAfterAction ? valueAfterAction : [],
      emailEntries: valueAfterAction
        ? valueAfterAction.map((option) => {
            return option.label;
          })
        : [],
    });
  };

  const handleEmailEntriesInputChange = (inputValue: string) => {
    setEmailEntriesOptions({
      ...emailEntriesOptions,
      inputValue,
    });
  };

  const createOption = (label: string) => ({
    label,
    value: label,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!emailEntriesOptions.inputValue) return;
    const valuesArray = emailEntriesOptions.inputValue
      .split(",")
      .map((option) => option.trim());
    const valueOptions = valuesArray.map((val) => {
      return createOption(val);
    });
    switch (e.key) {
      case "Enter":
      case "Tab":
        setEmailEntriesOptions({
          inputValue: "",
          valueOptions: [...emailEntriesOptions.valueOptions, ...valueOptions],
          emailEntries: [...emailEntriesOptions.emailEntries, ...valuesArray],
        });
        e.preventDefault();
        break;
      default:
        console.log("Unexpected keu pressed");
    }
  };

  const AccessTypeSelector = () => {
    return (
      <>
        <option key="default" value="">
          --Select--
        </option>
        <option key="remove" value="remove">
          None (Remove user)
        </option>
        {Object.values(AccessType).map((val) => (
          <option key={val} value={val}>
            {val}
          </option>
        ))}
      </>
    );
  };

  const handleInputChange = (e: any) => {
    const { value } = e.target;
    setSelectedAccessType(value);
  };

  const addGroupEntriesStateCallback = (
    addedGroupEntries: string[],
    newGroupEntries: GroupEntry[]
  ) => {
    if (addedGroupEntries.length === emailEntriesOptions.emailEntries.length) {
      setEmailEntriesOptions({
        inputValue: "",
        valueOptions: [],
        emailEntries: [],
      });
    } else {
      // Remove email entries already added
      const indexesToRemove = [];
      for (let i = 0; i < addedGroupEntries.length; i += 1) {
        const idxToRemove = emailEntriesOptions.emailEntries.indexOf(
          addedGroupEntries[i]
        );
        if (idxToRemove > -1) {
          indexesToRemove.push(idxToRemove);
        }
      }

      const emailEntriesToBeAdded = [...emailEntriesOptions.emailEntries];
      indexesToRemove.map((idx) => emailEntriesToBeAdded.splice(idx, 1));

      const valueOptionsToRemain = emailEntriesToBeAdded.map((emailEntry) => {
        return createOption(emailEntry);
      });
      setEmailEntriesOptions({
        inputValue: "",
        valueOptions: valueOptionsToRemain,
        emailEntries: emailEntriesToBeAdded,
      });
    }
    setGroupEntryTableData(newGroupEntries);
  };

  const updatedGroupEntriesStateCallback = (
    selectedEntries: Set<string>,
    newGroupEntries: GroupEntry[]
  ) => {
    setSelectedAccessType("");
    setGroupEntryTableData(newGroupEntries);
  };

  /* TODO: Add validater for email address and check if owner */

  return (
    <>
      <Form>
        <b>Group: {group.name}</b>
        <Row className={styles.container}>
          <Col xs={12} md={8}>
            <FormGroup
              controlId="emailEntries"
              validationState={
                groupEntryErrors?.addGroupEntryError ? "error" : undefined
              }
            >
              <TagInput
                inputValue={emailEntriesOptions.inputValue}
                value={emailEntriesOptions.valueOptions}
                onInputChange={handleEmailEntriesInputChange}
                onChange={() => {
                  if (Array.isArray(emailEntriesOptions.valueOptions)) {
                    throw new Error(
                      "Unexpected type passed to ReactSelect onChange handler"
                    );
                  }
                  return handleEmailEntriesChange;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type email or comma-separated email addresses and press 'Enter' or 'Tab'"
              />
              <HelpBlock>{groupEntryErrors?.addGroupEntryError}</HelpBlock>
            </FormGroup>
          </Col>
          <Col xs={6} md={4}>
            <Button
              disabled={emailEntriesOptions.emailEntries.length === 0}
              onClick={() => {
                const newGroupEntryArgs: GroupEntryArgs[] = [];
                emailEntriesOptions.emailEntries.forEach((emailEntry) => {
                  const params: GroupEntryArgs = {
                    email: emailEntry,
                    access_type: AccessType.read,
                    exact_match: true,
                  };
                  newGroupEntryArgs.push(params);
                });
                addGroupEntries(
                  group.id,
                  newGroupEntryArgs,
                  addGroupEntriesStateCallback
                );
              }}
            >
              Add
            </Button>
          </Col>
        </Row>
        <Row className={styles.container}>
          <Col xs={12} md={8}>
            <div>
              <WideTable
                data={groupEntryTableData}
                idProp="id"
                onChangeSelections={(selections) => {
                  setSelectedGroupEntries(new Set(selections));
                }}
                columns={[
                  { accessor: "email", Header: "Email" },
                  { accessor: "access_type", Header: "Access Type" },
                ]}
              />
            </div>
          </Col>
          <Col xs={6} md={4}>
            To change access, select rows on the left and then choose an access
            level below
            <FormGroup
              validationState={
                groupEntryErrors?.updateGroupEntryError ? "error" : undefined
              }
            >
              <FormControl
                componentClass="select"
                disabled={selectedGroupEntries.size === 0}
                onChange={handleInputChange}
                value={selectedAccessType}
              >
                <AccessTypeSelector />
              </FormControl>
              <Button
                onClick={() => {
                  updateGroupEntriesAccess(
                    group.id,
                    selectedGroupEntries,
                    selectedAccessType,
                    updatedGroupEntriesStateCallback
                  );
                }}
                disabled={
                  selectedGroupEntries.size === 0 || selectedAccessType === ""
                }
              >
                Update
              </Button>
              <HelpBlock>{groupEntryErrors?.updateGroupEntryError}</HelpBlock>
            </FormGroup>
          </Col>
        </Row>
      </Form>
    </>
  );
}

export default AddGroupEntryForm;
