import React from "react";
import { showInfoModal } from "@depmap/common-components";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import {
  convertContextV1toV2Core,
  InvalidDimensionTypeError,
} from "./context-converter-core";

export async function convertContextV1toV2(
  context: DataExplorerContext
): Promise<DataExplorerContextV2> {
  try {
    return await convertContextV1toV2Core(context);
  } catch (e) {
    if (e instanceof InvalidDimensionTypeError) {
      showInfoModal({
        title: "Error reading context",
        closeButtonText: "OK",
        content: <div>Invalid dimension type “{e.dimensionType}”.</div>,
      });
    }

    throw e;
  }
}
