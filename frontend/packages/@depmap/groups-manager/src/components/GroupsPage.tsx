import React, { useEffect, useState } from "react";
import {
  Group,
  GroupEntry,
  AccessType,
  ErrorTypeError,
  GroupArgs,
  GroupEntryArgs,
  GroupTableData,
} from "@depmap/types";

import { FormModal, Spinner, showInfoModal } from "@depmap/common-components";
import Button from "react-bootstrap/lib/Button";
import Modal from "react-bootstrap/lib/Modal";

import styles from "../styles/styles.scss";
import WideTable from "@depmap/wide-table";

import GroupAddDelete from "./GroupAddDelete";
import AddGroupEntryForm from "./AddGroupEntryForm";

export interface GroupsPageProps {
  getGroups: () => Promise<Group[]>;
  addGroup: (groupArgs: GroupArgs) => Promise<Group>;
  deleteGroup: (group_id: string) => Promise<unknown>;
  addGroupEntry: (
    groupId: string,
    groupEntryArgs: GroupEntryArgs
  ) => Promise<GroupEntry>;
  deleteGroupEntry: (groupEntryId: string) => void;
  user: string;
}

function formatTableData(groups: Group[]): GroupTableData[] {
  return groups.map((group) => {
    const groupEntries = group.group_entries;
    const groupEntriesCount = groupEntries.length;
    const datasetsCount = group.datasets
      ? group.datasets.length.toString()
      : "N/A";

    return {
      id: group.id,
      name: group.name,
      groupEntriesCount,
      groupEntries,
      datasetsCount,
    };
  });
}

export default function GroupsPage(props: GroupsPageProps) {
  const {
    getGroups,
    addGroup,
    deleteGroup,
    addGroupEntry,
    deleteGroupEntry,
    user,
  } = props;
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [showModal, setShowModal] = useState(true);
  const [groupToEditEntries, setGroupToEditEntries] = useState<Group | null>(
    null
  );
  const [addGroupError, setAddGroupError] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [groupEntryErrors, setGroupEntryErrors] = useState<{
    addGroupEntryError: string | null;
    updateGroupEntryError: string | null;
  }>({ addGroupEntryError: null, updateGroupEntryError: null });

  const editGroupEntriesHandler = (e: any, id: string) => {
    const entryGroup = groups?.find((group) => {
      return group.id === id;
    });
    if (entryGroup) {
      setShowModal(true);
      setGroupToEditEntries(entryGroup);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const currentGroups = await getGroups();
        setGroups(currentGroups);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, [getGroups]);

  if (!groups) {
    return error ? (
      <div className={styles.container}>
        Sorry, there was an error fetching groups.
      </div>
    ) : (
      <Spinner />
    );
  }

  const addButtonAction = async (groupArgs: GroupArgs) => {
    try {
      const group = await addGroup(groupArgs);

      setGroups([...groups, group]);
      setAddGroupError(null);
    } catch (e) {
      console.error(e);
      if (e instanceof ErrorTypeError) {
        setAddGroupError(e.message);
      } else {
        setAddGroupError("An unknown error occurred!");
      }
    }
  };

  const deleteButtonAction = async (groupIdsSet: Set<string>) => {
    const groupIds = [...groupIdsSet];
    const deletedIds = new Set<string>();
    let errorMessage: string | null = null;

    setDeleteProgress({ completed: 0, total: groupIds.length });

    try {
      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < groupIds.length; i += 1) {
        await deleteGroup(groupIds[i]);
        deletedIds.add(groupIds[i]);
        setDeleteProgress({
          completed: deletedIds.size,
          total: groupIds.length,
        });
      }
      /* eslint-enable no-await-in-loop */
    } catch (e) {
      console.error(e);
      errorMessage =
        e instanceof ErrorTypeError ? e.message : "An unknown error occurred!";
    } finally {
      // Drop whatever was successfully deleted, even if a later delete failed.
      setGroups((prevGroups) =>
        (prevGroups || []).filter((group) => !deletedIds.has(group.id))
      );
      setSelectedGroupIds(
        (prevSelected) =>
          new Set([...prevSelected].filter((id) => !deletedIds.has(id)))
      );
      setDeleteProgress(null);
    }

    if (errorMessage) {
      showInfoModal({
        title:
          groupIds.length === 1
            ? "Error deleting group"
            : "Error deleting groups",
        content: (
          <>
            <p>{errorMessage}</p>
            {groupIds.length > 1 ? (
              <p>
                {deletedIds.size} of {groupIds.length} selected groups were
                deleted before the error occurred.
              </p>
            ) : null}
          </>
        ),
      });
    }
  };

  const submitGroupEntries = async (
    groupId: string,
    groupEntryArgs: GroupEntryArgs[],
    addGroupEntriesStateCallback: (
      addedGroupEntries: string[],
      newGroupEntries: GroupEntry[]
    ) => void
  ) => {
    const index = groups.findIndex((group) => {
      return group.id === groupId;
    });
    const addedGroupEntries = [];
    const newGroups = [...groups];
    let newGroupEntries: GroupEntry[] = [];
    try {
      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < groupEntryArgs.length; i += 1) {
        const groupEntryArg = groupEntryArgs[i];
        const addedGroupEntry = await addGroupEntry(groupId, groupEntryArg);
        addedGroupEntries.push(addedGroupEntry.email);
        newGroups[index].group_entries = [
          ...newGroups[index].group_entries,
          addedGroupEntry,
        ];
        newGroupEntries = newGroups[index].group_entries;
        setGroups(newGroups);
        setGroupToEditEntries(newGroups[index]);
      }
      /* eslint-enable no-await-in-loop */

      setGroupEntryErrors({
        ...groupEntryErrors,
        addGroupEntryError: null,
      });
    } catch (e) {
      console.error(e);
      if (e instanceof ErrorTypeError) {
        setGroupEntryErrors({
          ...groupEntryErrors,
          addGroupEntryError: e.message,
        });
      } else {
        setGroupEntryErrors({
          ...groupEntryErrors,
          addGroupEntryError: "An unknown error occurred!",
        });
      }
    }
    addGroupEntriesStateCallback(addedGroupEntries, newGroupEntries);
  };

  const updateGroupEntries = async (
    groupId: string,
    groupEntryIds: Set<string>,
    accessEdit: string,
    updatedGroupEntriesStateCallback: (
      selectedGroupEntries: Set<string>,
      newGroupEntries: GroupEntry[]
    ) => void
  ) => {
    const index = groups.findIndex((group) => {
      return group.id === groupId;
    });
    const newGroups = [...groups];

    try {
      groupEntryIds.forEach(async (groupEntryId) => {
        await deleteGroupEntry(groupEntryId);
      });

      // if not removing access, create new group entry with new access type
      // then delete old group entries/selected group entries
      if (accessEdit !== "remove") {
        const groupEntriesToEdit = newGroups[index].group_entries.filter(
          (groupEntry) => {
            return groupEntryIds.has(groupEntry.id);
          }
        );
        const newGroupEntryArgs: GroupEntryArgs[] = groupEntriesToEdit.map(
          (groupEntry) => {
            return {
              email: groupEntry.email,
              exact_match: groupEntry.exact_match,
              access_type: accessEdit,
            };
          }
        ) as GroupEntryArgs[];
        const addedGroupEntries = await Promise.all([
          ...newGroupEntryArgs.map((groupEntryArgs) =>
            addGroupEntry(groupId, groupEntryArgs)
          ),
        ]);
        newGroups[index].group_entries = [
          ...newGroups[index].group_entries,
          ...addedGroupEntries,
        ];
      }
      newGroups[index].group_entries = newGroups[index].group_entries.filter(
        (groupEntry) => {
          return !groupEntryIds.has(groupEntry.id);
        }
      );
      setGroups(newGroups);
      setGroupToEditEntries(newGroups[index]);
      setGroupEntryErrors({
        ...groupEntryErrors,
        updateGroupEntryError: null,
      });
    } catch (e) {
      console.error(e);
      if (e instanceof ErrorTypeError) {
        setGroupEntryErrors({
          ...groupEntryErrors,
          updateGroupEntryError: e.message,
        });
      } else {
        setGroupEntryErrors({
          ...groupEntryErrors,
          updateGroupEntryError: "An unknown error occurred!",
        });
      }
    }
    updatedGroupEntriesStateCallback(
      groupEntryIds,
      newGroups[index].group_entries
    );
  };

  const groupEntryForm = groupToEditEntries ? (
    <AddGroupEntryForm
      group={groupToEditEntries}
      addGroupEntries={submitGroupEntries}
      updateGroupEntriesAccess={updateGroupEntries}
      groupEntryErrors={groupEntryErrors}
    />
  ) : null;

  return (
    <>
      <GroupAddDelete
        selectedGroupIds={selectedGroupIds}
        onAdd={addButtonAction}
        onDelete={deleteButtonAction}
        errorMessage={addGroupError}
        isDeleting={deleteProgress !== null}
      />
      {deleteProgress ? (
        <Modal show backdrop="static" keyboard={false} onHide={() => {}}>
          <Modal.Header>
            <Modal.Title>
              {deleteProgress.total === 1
                ? "Deleting group"
                : `Deleting ${deleteProgress.total} groups`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              This can take several minutes, because every dataset has to be
              checked for access changes. Please don’t close this page.
            </p>
            {deleteProgress.total > 1 ? (
              <p>
                <b>
                  Deleted {deleteProgress.completed} of {deleteProgress.total}.
                </b>
              </p>
            ) : null}
            <div className={styles.deletingSpinner}>
              <Spinner position="static" />
            </div>
          </Modal.Body>
        </Modal>
      ) : null}
      {groupToEditEntries && groupEntryForm ? (
        <FormModal
          bsSize="large"
          title="Edit Members"
          showModal={showModal}
          onHide={() => setShowModal(false)}
          formComponent={groupEntryForm}
        />
      ) : null}
      <WideTable
        rowHeight={50}
        idProp="id"
        onChangeSelections={(selections) => {
          setSelectedGroupIds(new Set(selections));
        }}
        data={formatTableData(groups)}
        columns={[
          {
            accessor: "groupEntries",
            Header: "",
            maxWidth: 100,
            disableFilters: true,
            disableSortBy: true,
            Cell: (cellProps: any) => {
              const groupEntries: GroupEntry[] = cellProps.value;
              // If user is owner of group, show group edit button
              const cellButton =
                groupEntries.find(
                  (entry) =>
                    entry.email === user &&
                    entry.access_type === AccessType.owner
                ) !== undefined ? (
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    <Button
                      id={cellProps.row.original.id}
                      bsStyle="primary"
                      onClick={(e) =>
                        editGroupEntriesHandler(e, cellProps.row.original.id)
                      }
                    >
                      Edit
                    </Button>
                  </div>
                ) : null;

              return cellButton;
            },
          },
          { accessor: "name", Header: "Name" },
          { accessor: "groupEntriesCount", Header: "Members" },
          { accessor: "datasetsCount", Header: "Datasets" },
        ]}
      />
    </>
  );
}
