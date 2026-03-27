import { CeleryTask } from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson } from "../client";

export function getTaskStatus(id: string) {
  return getJson<CeleryTask>(uri`/api/task/${id}`);
}
