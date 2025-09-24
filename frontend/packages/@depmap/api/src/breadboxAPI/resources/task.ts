import { CeleryTask } from "@depmap/compute";
import { getJson } from "../client";

export function getTaskStatus(id: string) {
  return getJson<CeleryTask>(`/api/task/${id}`);
}
