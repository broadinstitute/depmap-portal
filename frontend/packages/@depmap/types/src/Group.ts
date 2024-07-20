import { Dataset } from "./Dataset";

export default interface Group {
  id: string;
  name: string;
  group_entries: GroupEntry[];
  datasets: Dataset[];
}

export interface GroupEntry {
  access_type: AccessType;
  email: string;
  exact_match: boolean;
  id: string;
}

export interface GroupArgs {
  name: string;
}

export enum AccessType {
  read = "read",
  write = "write",
  owner = "owner",
}

export interface GroupEntryArgs {
  email: string;
  exact_match: boolean;
  access_type: AccessType;
}

export interface GroupTableData {
  id: string;
  name: string;
  groupEntries: GroupEntry[];
  groupEntriesCount: number;
  datasetsCount: string;
}
