import { DimensionMetadata } from "@depmap/types";
import { getJson } from "../client";

export function getMetadata(label: string) {
  return getJson<DimensionMetadata>(`/metadata/`, { label });
}

export function getSearchOptions(text: string) {
  return getJson<{ labels: string[] }>("/metadata/search/", { text });
}
