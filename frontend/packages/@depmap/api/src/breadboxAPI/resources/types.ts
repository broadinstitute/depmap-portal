import {
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
} from "@depmap/types";
import { getJson, postJson, patchJson, deleteJson } from "../client";

export function getDimensionTypes() {
  return getJson<DimensionType[]>("/types/dimensions");
}

export function getDimensionType(name: string) {
  return getJson<DimensionType>(`/types/dimensions/${name}`);
}

export function postDimensionType(dimTypeArgs: DimensionTypeAddArgs) {
  return postJson<DimensionType>("/types/dimensions", dimTypeArgs);
}

export function updateDimensionType(
  dimTypeName: string,
  dimTypeArgs: DimensionTypeUpdateArgs
) {
  return patchJson<DimensionType>(
    `/types/dimensions/${dimTypeName}`,
    dimTypeArgs
  );
}

export function deleteDimensionType(name: string) {
  // TODO: Figure out return type.
  return deleteJson<unknown>("/types/dimensions", name);
}

type Identifiers = { id: string; label: string }[];

export function getDimensionTypeIdentifiers(
  dimTypeName: string,
  params?: {
    data_type?: string;
    // NOTE: This is known to affect performance.
    show_only_dimensions_in_datasets?: boolean;
  }
) {
  return getJson<Identifiers>(
    `/types/dimensions/${dimTypeName}/identifiers`,
    params
  );
}
