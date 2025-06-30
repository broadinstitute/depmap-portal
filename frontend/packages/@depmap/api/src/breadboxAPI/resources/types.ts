import {
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
} from "@depmap/types";
import {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  getJsonCached,
} from "../client";

export function getDimensionTypes() {
  return getJson<DimensionType[]>("/types/dimensions");
}

export function getDimensionType(name: string) {
  return getJsonCached<DimensionType>(`/types/dimensions/${name}`);
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
  return deleteJson<any>("/types/dimensions", name);
}
