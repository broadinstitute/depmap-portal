/* eslint-disable */
import { LinRegInfo } from "@depmap/types";

export interface Association {
  other_entity_label: string;
  other_dataset: string;
  other_dataset_name: string;
  correlation: number;
  p_value: number;
  z_score: number;
}

export type Catalog =
  | "continuous"
  | "categorical"
  | "continuous_and_categorical"
  | "binary";

export class DropdownOption {
  // an option is a child
  label: string;

  id: string;

  optionValue: string; // named to disambiguate from the react-select expected 'value' property

  url: string | null;

  terminal: boolean;

  isNotFound?: boolean; // flag to indicate that this option is a placeholder of sorts, used to indicate that the dropdown state's previously selection option is no longer available in the new options. a not found dropdown can only be created by updateDownstreamDropdowns

  group?: string;

  constructor(
    label: string,
    terminal = false,
    optionValue: string | undefined = undefined,
    isNotFound = false
  ) {
    this.label = label;
    this.id = isNotFound ? "isNotFound" : label;
    this.optionValue = optionValue || label;
    this.url = null;
    this.terminal = terminal; // for the blank default option, just say terminal false
    if (isNotFound) {
      // don't even set this property unless it is true. because some constructions of dropdownoption go through this constructor, some don't
      this.isNotFound = isNotFound; // for the blank default option, just say terminal false
    }
  }
}

export interface DropdownState {
  // a dropdown is a node
  dropdownId: string; // the identifier of a dropdown is the id of its parent option
  selected: DropdownOption;
  options: Array<DropdownOption>;
  type: "dynamic" | "static";
  placeholder: string;
  persistSelectedIfNotFound: boolean;
  isLoading: boolean;
  numInputRequests: number;
}

export interface OptionsInfo {
  children: Array<DropdownOption>;
  type: "dynamic" | "static";
  placeholder: string;
  persistSelectedIfNotFound: boolean;
}

export interface OptionsInfoSelected extends OptionsInfo {
  selectedId: string;
}

export interface Link {
  link: string | null;
  value: string;
  label: string;
}

export class SectionState {
  id: string;

  links: Array<Link>;

  isDisabled?: boolean;

  constructor(id = "", links: Array<Link> = [], isDisabled = false) {
    this.id = id;
    this.links = links;
    this.isDisabled = isDisabled;
  }
}

export interface LinearRegResult {
  slope: number;
  intercept: number;
}

export interface CellLineInfoItem {
  depmap_id: string;
  cell_line_display_name: string;
  primary_disease: string;
}

export interface Trace {
  x: Array<number>;
  label: Array<string>;
  depmap_id: Array<string>;
  cell_line_information?: Array<{
    depmap_id: string;
    cell_line_display_name: string;
    primary_disease: string;
  }>;
  name: string;
  y?: Array<number>;
  linregress_y?: Array<number>;
  color?: string | number; // if string, includes the # character
  color_dataset: string;
}

export interface Feature {
  feature_id: string;
  values: (number | string)[]; // number list or string list
  label: string; // "SOX10"
  axis_label: string;
}

export interface FeatureGroup {
  group_name: string;
  depmap_ids: string[];
  color_num: string | number;
}

export interface PlotFeatures {
  linreg_by_group: LinRegInfo[];
  depmap_ids: string[];
  features: Feature[];
  group_by: string;
  groups: FeatureGroup[];
  supplement_details: Feature[];
}
export interface AssociationAndCheckbox {
  data: Array<Association>;
  associatedDatasets: Array<string>;
  datasetLabel: string;
  featureLabel: string;
  checkboxes: { label: string; name: string }[];
}

export interface AddDatasetOneRowArgs {
  uploadFile?: any;
}

export const dropdownsToLinks = (dropdowns: Array<DropdownState>) => {
  return dropdowns.map((dropdown) => {
    return {
      link: dropdown.selected.url,
      label: dropdown.selected.label,
      value: dropdown.selected.optionValue,
    };
  });
};

export type OverrideSection = "color" | "filter";
export type Section = "x" | "y" | OverrideSection;
export enum MetadataIds {
  primaryDisease = "primary_disease",
  cellLineDisplayName = "cell_line_display_name",
  lineageDisplayName = "lineage_display_name",
}
