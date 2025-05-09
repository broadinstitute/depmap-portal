/* eslint-disable */
import { BreadboxApi } from "src/bbAPI";
import { DepmapApi } from "src/dAPI";

let dapi: DepmapApi;
let bbapi: BreadboxApi;

export function fetchUrlPrefix() {
  const element = document.getElementById("webpack-config");
  const webpackConfig = JSON.parse(element!.textContent as string);
  return webpackConfig.rootUrl;
}

export function getDapi(): DepmapApi {
  if (typeof dapi === "undefined") {
    dapi = new DepmapApi(fetchUrlPrefix());
  }
  return dapi;
}

export function getBreadboxApi(): BreadboxApi {
  if (typeof bbapi === "undefined") {
    const prefix = fetchUrlPrefix();
    if (prefix == "/") {
      bbapi = new BreadboxApi("http://127.0.0.1:8000");
      return bbapi;
    }

    bbapi = new BreadboxApi(`${prefix}/breadbox`);
  }
  return bbapi;
}

export const apiFunctions = {
  breadbox: {
    getApi: getBreadboxApi,
  },
  depmap: {
    getApi: getDapi,
  },
};
