import { getJson } from "../client";

export function getBreadboxUser() {
  return getJson<string>("/user/");
}
