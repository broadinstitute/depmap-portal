import { breadboxAPI, cached } from "@depmap/api";
import { AnnotationType, DataExplorerContextVariable } from "@depmap/types";
import { compareCaseInsensitive } from "@depmap/utils";

export async function fetchVariableDomain(
  variable: DataExplorerContextVariable
) {
  const { dataset_id, identifier, identifier_type } = variable;
  const sliceQuery = { dataset_id, identifier, identifier_type };
  let value_type: AnnotationType | undefined;

  const datasets = await cached(breadboxAPI).getDatasets();
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (dataset && dataset.format === "matrix_dataset") {
    value_type = dataset.value_type as AnnotationType;
  }

  if (dataset && dataset.format === "tabular_dataset") {
    if (identifier_type !== "column") {
      throw new Error(
        `Can't look up identifier_type "${identifier_type}"` +
          "in a tabular dataset!"
      );
    }

    const column = dataset.columns_metadata[identifier];

    if (!column) {
      throw new Error(
        `Column "${identifier}" not found in dataset "${dataset.id}".`
      );
    }

    value_type = column.col_type;
  }

  let data = {
    values: [] as (string | string[] | number | null)[],
  };

  try {
    data = await cached(breadboxAPI).getDimensionData(sliceQuery);
  } catch {
    window.console.error({ sliceQuery });
    throw new Error("Error fetching data from slice query");
  }

  if (!("values" in data)) {
    window.console.error({
      sliceQuery,
      response: data,
    });
    throw new Error(
      "Bad response from /datasets/dimension/data/. Contains no `values!`"
    );
  }

  if (value_type === "text" || value_type === "categorical") {
    const stringValues = data.values.filter(
      (val) => typeof val === "string"
    ) as string[];

    return Promise.resolve({
      unique_values: [...new Set(stringValues)].sort(compareCaseInsensitive),
      value_type,
    });
  }

  if (value_type === "continuous") {
    const numberValues = data.values.filter(
      (val) => typeof val === "number"
    ) as number[];

    return Promise.resolve({
      min: Math.min(...numberValues),
      max: Math.max(...numberValues),
      value_type,
    });
  }

  throw new Error(`Unsupported value_type "${value_type}".`);
}
