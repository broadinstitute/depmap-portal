import { InvalidPrioritiesByDataType } from "@depmap/types";
import { getJson } from "../client";

export function getDataTypesAndPriorities() {
  return getJson<InvalidPrioritiesByDataType>("/data_types/priorities");
}
