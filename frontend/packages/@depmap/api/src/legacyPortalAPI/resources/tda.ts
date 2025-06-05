import { getUrlPrefix } from "@depmap/globals";
import { getJson } from "../client";

const getText = (url: string): Promise<string> => {
  return fetch(getUrlPrefix() + url, {
    credentials: "include",
  }).then((response: Response) => {
    return response.text();
  });
};

export function getTDASummaryTable() {
  return getJson<{ symbol: string[] }>("/tda/summary_table");
}

export function getTDATableAsOriginalCSV() {
  return getText("/tda/table_download");
}
