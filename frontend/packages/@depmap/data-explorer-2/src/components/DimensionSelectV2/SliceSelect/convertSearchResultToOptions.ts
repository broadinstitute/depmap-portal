import { SearchDimenionsResponse } from "@depmap/types";
import { useDataExplorerApi } from "../../../contexts/DataExplorerApiContext";

async function fetchDataTypeCompatibleIds(
  api: ReturnType<typeof useDataExplorerApi>,
  slice_type: string,
  dataType: string | null
) {
  const ids = await api.fetchDimensionIdentifiers(
    slice_type,
    dataType || undefined
  );

  return new Set(ids.map(({ id }) => id));
}

async function fetchDataVersionCompatibleIds(
  api: ReturnType<typeof useDataExplorerApi>,
  slice_type: string,
  dataset_id: string | null
) {
  if (!dataset_id) {
    return null;
  }

  const ids = await api.fetchDatasetIdentifiers(slice_type, dataset_id);
  return new Set(ids.map(({ id }) => id));
}

async function fetchDimensionTypeDisplayName(
  api: ReturnType<typeof useDataExplorerApi>,
  dimensionTypeName: string
) {
  const dimensionTypes = await api.fetchDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  return dimType.display_name || dimType.name;
}

async function fetchDatasetName(
  api: ReturnType<typeof useDataExplorerApi>,

  dataset_id: string | null
) {
  if (!dataset_id) {
    return "";
  }

  const datasets = await api.fetchDatasets();
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}".`);
  }

  return dataset.name;
}

const chainLength = (str: string) => str.split(".").length;

async function convertSearchResultToOptions(
  tokens: string[],
  result: SearchDimenionsResponse,
  api: ReturnType<typeof useDataExplorerApi>,
  slice_type: string,
  dataType: string | null,
  dataset_id: string | null
) {
  let error = false;

  const asyncData = await (() => {
    return Promise.all([
      fetchDataTypeCompatibleIds(api, slice_type, dataType),
      fetchDataVersionCompatibleIds(api, slice_type, dataset_id),
      fetchDimensionTypeDisplayName(api, slice_type),
      fetchDatasetName(api, dataset_id),
    ]).catch((e) => {
      window.console.log(e);
      error = true;
    });
  })();

  if (error) {
    return [];
  }

  const [
    dataTypeCompatibleIds,
    dataVersionCompatibleIds,
    dimesionTypeDisplayName,
    datasetName,
  ] = asyncData!;

  return result
    .map(({ id, label, matching_properties }) => {
      let isDisabled = false;
      let disabledReason = "";

      if (!dataTypeCompatibleIds.has(id)) {
        isDisabled = true;

        disabledReason = [
          `The data type “${dataType}”`,
          "has no data versions with this",
          dimesionTypeDisplayName,
        ].join(" ");
      } else if (
        dataVersionCompatibleIds &&
        !dataVersionCompatibleIds.has(id)
      ) {
        isDisabled = true;

        disabledReason = [
          "The data version",
          `“${datasetName}”`,
          "doesn’t include this",
          dimesionTypeDisplayName,
        ].join(" ");
      }

      const groupedProps: Record<string, Set<string>> = {};

      const tokenMatches = tokens
        .map((token) => {
          const lowercaseToken = token.toLowerCase();

          return matching_properties
            .filter(({ property }) => property !== "label")
            .filter(({ value }) => {
              return value.toLowerCase().includes(lowercaseToken);
            })
            .sort((a, b) => {
              return chainLength(a.property) - chainLength(b.property);
            })[0];
        })
        .filter(Boolean);

      tokenMatches.forEach(({ property, value }) => {
        const prop = property
          // no underscores
          .replace(/_/g, " ")
          // capitalize "ID"
          .replace(/\bids?\b/gi, "ID")
          // Never use "label" as a nested property (it doesn't give the user
          // any real information)
          .replace(/\.label$/, "")
          // Now return only the last member of the property chain (this
          // assumes that's the most meaningful info we can show the user).
          .split(".")
          .slice(-1)[0];

        groupedProps[prop] ||= new Set();
        groupedProps[prop].add(value);
      });

      const nonLabelProperties = Object.keys(groupedProps)
        .filter((property) => property !== "label")
        .map((property) => ({
          property,
          values: [...groupedProps[property]],
        }));

      return {
        value: id,
        label,
        isDisabled,
        disabledReason,
        nonLabelProperties,
      };
    })
    .sort((a, b) => {
      if (a.isDisabled && !b.isDisabled) {
        return 1;
      }

      if (!a.isDisabled && b.isDisabled) {
        return -1;
      }

      const labelA = (
        a.nonLabelProperties[0]?.values[0] || a.label
      )?.toLowerCase();

      const labelB = (
        b.nonLabelProperties[0]?.values[0] || b.label
      )?.toLowerCase();

      if (tokens.length === 0) {
        return labelA < labelB ? -1 : 1;
      }

      const indexA = tokens.reduce(
        (sum, token) => labelA.indexOf(token) + sum,
        0
      );
      const indexB = tokens.reduce(
        (sum, token) => labelB.indexOf(token) + sum,
        0
      );

      if (indexA === indexB) {
        return labelA < labelB ? -1 : 1;
      }

      return indexA < indexB ? -1 : 1;
    });
}

export default convertSearchResultToOptions;
