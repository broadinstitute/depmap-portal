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

// Email addresses can be separated by whitespace or commas.
const parseEmails = (value: string) =>
  value.split(/[\s,]+/).filter((email) => email !== "");

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);

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

  // Turns whatever has been typed so far into tags.
  const commitInputValue = () => {
    const emails = parseEmails(emailEntriesOptions.inputValue);

    setEmailEntriesOptions({
      inputValue: "",
      valueOptions: [
        ...emailEntriesOptions.valueOptions,
        ...emails.map(createOption),
      ],
      emailEntries: [...emailEntriesOptions.emailEntries, ...emails],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" && e.key !== "Tab" && e.key !== " ") {
      return;
    }

    // A space is never part of an email address, so swallow it even when
    // there's nothing to commit yet.
    if (e.key === " ") {
      e.preventDefault();
    }

    if (parseEmails(emailEntriesOptions.inputValue).length === 0) {
      return;
    }

    e.preventDefault();
    commitInputValue();
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
    // Keep whatever wasn't added, so a partial failure leaves the offending
    // addresses in the input for the user to correct.
    setEmailEntriesOptions((prev) => {
      const remaining = [
        ...prev.emailEntries,
        ...parseEmails(prev.inputValue),
      ].filter((email) => !addedGroupEntries.includes(email));

      return {
        inputValue: "",
        valueOptions: remaining.map(createOption),
        emailEntries: remaining,
      };
    });
    setGroupEntryTableData(newGroupEntries);
  };

  const updatedGroupEntriesStateCallback = (
    selectedEntries: Set<string>,
    newGroupEntries: GroupEntry[]
  ) => {
    setSelectedAccessType("");
    setGroupEntryTableData(newGroupEntries);
  };

  /* TODO: check if owner */

  // Uncommitted input counts towards the Add button, so a single address
  // doesn't have to be turned into a tag first. It only counts once it looks
  // like an email address, otherwise a half-typed one would enable Add.
  const pendingEmails = parseEmails(emailEntriesOptions.inputValue);
  const emailsToAdd =
    pendingEmails.length > 0 && pendingEmails.every(isValidEmail)
      ? [...emailEntriesOptions.emailEntries, ...pendingEmails]
      : emailEntriesOptions.emailEntries;

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
                onChange={handleEmailEntriesChange}
                onKeyDown={handleKeyDown}
                placeholder="Type one or more email addresses, separated by spaces or commas"
              />
              <HelpBlock>{groupEntryErrors?.addGroupEntryError}</HelpBlock>
            </FormGroup>
          </Col>
          <Col xs={6} md={4}>
            <Button
              disabled={emailsToAdd.length === 0}
              onClick={() => {
                const newGroupEntryArgs: GroupEntryArgs[] = emailsToAdd.map(
                  (emailEntry) => ({
                    email: emailEntry,
                    access_type: AccessType.read,
                    exact_match: true,
                  })
                );
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
