export type FilterLayout = FilterSection[];

export interface FilterSection {
  label: string;
  groups: FilterGroup[];
}

export interface FilterGroup {
  keys: string[];
  label?: string;
  collapsible?: boolean;
  groupCheckboxes?: boolean;
}
