import { Group, GroupArgs, GroupEntry, GroupEntryArgs } from "@depmap/types";
import { getJson, postJson, deleteJson } from "../client";

export function getGroups(write_access: boolean = false) {
  return getJson<Group[]>("/groups/", { write_access });
}

export function postGroup(groupArgs: GroupArgs) {
  return postJson<Group>("/groups/", groupArgs);
}

export function deleteGroup(id: string) {
  // TODO: Figure out return type.
  return deleteJson<any>("/groups", id);
}

export function postGroupEntry(
  groupId: string,
  groupEntryArgs: GroupEntryArgs
) {
  return postJson<GroupEntry>(`/groups/${groupId}/addAccess`, groupEntryArgs);
}

export function deleteGroupEntry(groupEntryId: string) {
  return deleteJson(`/groups/${groupEntryId}/removeAccess`, { groupEntryId });
}
