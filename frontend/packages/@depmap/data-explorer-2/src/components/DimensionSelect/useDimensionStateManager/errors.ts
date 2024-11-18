/* eslint-disable max-classes-per-file */
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import { capitalize, getDimensionTypeLabel } from "../../../utils/misc";
import { Changes, State } from "./types";

export class MismatchedSliceTypeError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MismatchedSliceTypeError";
  }
}

export class UnknownDatasetError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UnknownDatasetError";
  }
}

export function handleError(
  error: Error,
  prevState: State,
  changes: Changes,
  datasets: DataExplorerDatasetDescriptor[]
) {
  if (error instanceof MismatchedSliceTypeError) {
    const slice_type = datasets.find(
      (d) => d.dataset_id === prevState.dimension.dataset_id
    )?.slice_type;

    window.console.error(error);
    window.console.warn(
      `Ignoring this error and setting slice_type to "${slice_type}"`
    );

    return {
      ...prevState,
      dimension: {
        ...prevState.dimension,
        slice_type,
      },
    };
  }

  if (error instanceof UnknownDatasetError) {
    const dataTypes = [...new Set(datasets.map((d) => d.data_type))].sort();
    let dirty = false;
    let dimension = prevState.dimension;

    if ("context" in changes) {
      dirty = true;

      dimension = {
        ...prevState.dimension,
        context: changes.context || undefined,
      };
    }

    return {
      ...prevState,
      dirty,
      dimension,
      dataType: "custom",
      dataTypeOptions: [
        {
          label: "Custom",
          value: "custom",
          isDisabled: false,
          disabledReason: "",
        },
        ...dataTypes.map((dataType) => {
          return {
            label: dataType,
            value: dataType,
            isDisabled: true,
            disabledReason: "This data type is incompatible with custom data",
          };
        }),
      ],

      sliceTypeOptions: [
        {
          label: capitalize(
            getDimensionTypeLabel(prevState.dimension.slice_type as string)
          ),
          value: prevState.dimension.slice_type as string,
          isDisabled: false,
          disabledReason: "",
        },
      ],

      dataVersionOptions: [
        {
          label: "Custom",
          value: prevState.dimension.dataset_id as string,
          isDisabled: false,
          isDefault: true,
          disabledReason: "",
        },
      ],
    };
  }

  window.console.error("Error applying changes", { prevState, changes });
  window.console.error(error);
  throw new Error("^^^ unhandled DimensionSelect error ^^^");
}
