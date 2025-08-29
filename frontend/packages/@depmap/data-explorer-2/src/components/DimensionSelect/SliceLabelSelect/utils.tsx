import React, { useCallback, useEffect, useState } from "react";
import { breadboxAPI } from "@depmap/api";
import { Highlighter, Tooltip, WordBreaker } from "@depmap/common-components";
import { deprecatedDataExplorerAPI } from "../../../services/deprecatedDataExplorerAPI";
import { getDimensionTypeLabel } from "../../../utils/misc";
import { SearchDimenionsResponse } from "@depmap/types";
import styles from "../../../styles/DimensionSelect.scss";

interface Option {
  value: string;
  label: string;
  nonLabelProperties: {
    property: string;
    values: string[];
  }[];
  isDisabled: boolean;
  disabledReason: string;
}

export const getPlaceholder = (slice_type: string) => {
  return `Choose ${getDimensionTypeLabel(slice_type)}…`;
};

function tokenize(input: string | null) {
  const str = input || "";
  const tokens = str.split(/\s+/g).filter(Boolean);
  const uniqueTokens = new Set(tokens);

  return [...uniqueTokens];
}

export function useSearch() {
  return useCallback((input: string, type_name: string) => {
    return breadboxAPI.searchDimensions({
      substring: tokenize(input),
      type_name,
      limit: 100,
    });
  }, []);
}

function doNotOverlap(a: number[], b: number[]) {
  const setA = new Set(a);

  for (let i = 0; i < b.length; i += 1) {
    if (setA.has(b[i])) {
      return false;
    }
  }

  return true;
}

async function fetchSliceLabelsAndAliases(
  slice_type: string | null,
  dataType: string | null,
  dataset_id: string | null,
  units: string | null
) {
  if (!slice_type) {
    return {
      sliceLabels: [],
      aliases: null,
      disabledReasons: {},
    };
  }

  const mapping = await deprecatedDataExplorerAPI.fetchDimensionLabelsToDatasetsMapping(
    slice_type
  );
  const labels = Object.keys(mapping.dimension_labels);
  const reasons: Record<string, string> = {};

  if (labels.length === 0) {
    return {
      sliceLabels: [],
      aliases: null,
      disabledReasons: reasons,
    };
  }

  const dsIndex = mapping.dataset_ids.findIndex((id) => id === dataset_id);

  const typeIndices = dataType ? mapping.data_types[dataType] : [];
  const unitsIndices = units ? mapping.units[units] : [];

  Object.entries(mapping.dimension_labels).forEach(([label, dsIndices]) => {
    if (units && doNotOverlap(unitsIndices, dsIndices)) {
      reasons[label] = [
        `This ${getDimensionTypeLabel(slice_type)}`,
        `has no “${units}” measurement`,
      ].join(" ");
    }

    if (dsIndex !== -1 && !dsIndices.includes(dsIndex)) {
      reasons[label] = [
        "The data version",
        `“${mapping.dataset_labels[dsIndex]}”`,
        "doesn’t include this",
        getDimensionTypeLabel(slice_type),
      ].join(" ");
    }

    if (dataType && doNotOverlap(typeIndices, dsIndices)) {
      reasons[label] = [
        `The data type “${dataType}”`,
        "has no data versions with this",
        getDimensionTypeLabel(slice_type),
      ].join(" ");
    }
  });

  return {
    sliceLabels: labels,
    aliases: mapping.aliases,
    disabledReasons: reasons,
  };
}

export function useSliceLabels(
  slice_type: string | null,
  dataType: string | null,
  dataset_id: string | null,
  units: string | null
) {
  const [error, setError] = useState(false);
  const [sliceLabels, setSliceLabels] = useState<string[] | null>(null);
  const [aliases, setAliases] = useState<string[] | null>(null);
  const [disabledReasons, setDisabledReasons] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setSliceLabels(null);
    setError(false);

    (async () => {
      if (slice_type) {
        try {
          const fetchedData = await fetchSliceLabelsAndAliases(
            slice_type,
            dataType,
            dataset_id,
            units
          );

          setSliceLabels(fetchedData.sliceLabels);
          setAliases(fetchedData.aliases);
          setDisabledReasons(fetchedData.disabledReasons);
        } catch (e) {
          setError(true);
          window.console.error(e);
        }
      }
    })();
  }, [slice_type, dataType, dataset_id, units]);

  const waitForCachedValues = useCallback(() => {
    return fetchSliceLabelsAndAliases(slice_type, dataType, dataset_id, units);
  }, [slice_type, dataType, dataset_id, units]);

  return {
    aliases,
    disabledReasons,
    sliceLabels,
    error,
    waitForCachedValues,
  };
}

const makeSortComparator = (tokens: string[]) => (a: Option, b: Option) => {
  if (a.isDisabled && !b.isDisabled) {
    return 1;
  }

  if (!a.isDisabled && b.isDisabled) {
    return -1;
  }

  const labelA = (a.nonLabelProperties[0]?.values[0] || a.label)?.toLowerCase();
  const labelB = (b.nonLabelProperties[0]?.values[0] || b.label)?.toLowerCase();

  if (tokens.length === 0) {
    return labelA < labelB ? -1 : 1;
  }

  const indexA = tokens.reduce((sum, token) => labelA.indexOf(token) + sum, 0);
  const indexB = tokens.reduce((sum, token) => labelB.indexOf(token) + sum, 0);

  if (indexA === indexB) {
    return labelA < labelB ? -1 : 1;
  }

  return indexA < indexB ? -1 : 1;
};

export function toReactSelectOptions(
  searchResults: SearchDimenionsResponse,
  inputValue: string | null,
  sliceLabels: string[],
  disabledReasons: Record<string, string>
) {
  const tokens = tokenize(inputValue);
  const labelsWithAdditionalMatchingProps = new Set(
    searchResults
      .filter(({ matching_properties }) => matching_properties.length > 1)
      .map(({ label }) => label)
  );

  // `labelOptions` is a fallback for cases where the search indexer doesn't
  // know anything about the given dimension type.
  const labelOptions = sliceLabels
    // Prefer showing results from the search indexer, where they exist.
    .filter((label) => !labelsWithAdditionalMatchingProps.has(label))
    .filter((label) => {
      return (
        // If the user hasn't typed anything yet, present the full list
        // (to support the ability to browse samples/features which is
        // most useful when then the list is fairly short).
        tokens.length === 0 ||
        // Otherwise, try to match all tokens.
        tokens.every((token) =>
          label.toLowerCase().includes(token.toLowerCase())
        )
      );
    })
    .map((label) => ({
      label,
      value: label,
      nonLabelProperties: [],
      isDisabled: Boolean(disabledReasons[label]),
      disabledReason: disabledReasons[label],
    }));

  const labels = new Set(sliceLabels);

  const searchIndexOptions = searchResults
    .filter((result) => labels.has(result.label))
    .filter((result) => {
      return (
        result.matching_properties.length > 1 ||
        result.matching_properties[0].property !== "label"
      );
    })
    .map((result) => {
      const chainLength = (str: string) => str.split(".").length;

      const tokenMatches = tokens
        .map((token) => {
          const lowercaseToken = token.toLowerCase();

          return result.matching_properties
            .filter(({ property }) => property !== "label")
            .filter(({ value }) => {
              return value.toLowerCase().includes(lowercaseToken);
            })
            .sort((a, b) => {
              return chainLength(a.property) - chainLength(b.property);
            })[0];
        })
        .filter(Boolean);

      const groupedProps: Record<string, Set<string>> = {};

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
        value: result.label,
        label: result.label,
        nonLabelProperties,
        isDisabled: Boolean(disabledReasons[result.label]),
        disabledReason: disabledReasons[result.label],
      };
    });

  return [...labelOptions, ...searchIndexOptions].sort(
    makeSortComparator(tokens)
  );
}

// FIXME: We have a special case for models because they can be searched by
// aliases. In practice there is only one alias we use, which is the cell line
// name. This concept is a holdover from a time before the search indexer.
// Going forward, we should instead make sure that the depmap_model sample type
// has CellLineName (or StrippedCellLineName?) as one of its
// `properties_to_index`.
export function toDemapModelOptions(
  searchResults: SearchDimenionsResponse,
  inputValue: string | null,
  sliceLabels: string[],
  aliases: string[] | null,
  disabledReasons: Record<string, string>
) {
  const tokens = tokenize(inputValue);
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};

  if (aliases && aliases.length > 0) {
    sliceLabels.forEach((label, i) => {
      const alias = aliases[i];
      nameToId[alias] = label;
      idToName[label] = alias;
    });
  }

  const aliasOptions = !aliases
    ? []
    : aliases
        .filter((cellLineName) => {
          return (
            // If the user hasn't typed anything yet, present the full list
            // (to support the ability to browse samples/features which is
            // most useful when then the list is fairly short).
            tokens.length === 0 ||
            // Otherwise try to match all tokens.
            tokens.every((token) =>
              cellLineName?.toLowerCase().includes(token.toLowerCase())
            )
          );
        })
        .map((cellLineName) => {
          return {
            label: cellLineName,
            value: nameToId[cellLineName],
            nonLabelProperties: [],
            isDisabled: Boolean(disabledReasons[nameToId[cellLineName]]),
            disabledReason: disabledReasons[nameToId[cellLineName]],
          };
        })
        .sort((a, b) => (a.label < b.label ? -1 : 1));

  const labelAndSearchIndexOptions = toReactSelectOptions(
    searchResults,
    inputValue,
    sliceLabels,
    disabledReasons
  ).map((option) => {
    if (option.nonLabelProperties.length > 0) {
      return {
        ...option,
        label: idToName[option.label],
        isDisabled: Boolean(disabledReasons[option.value]),
        disabledReason: disabledReasons[option.value],
      };
    }

    return {
      value: option.label,
      label: idToName[option.label],
      nonLabelProperties: [
        {
          property: "DepMap ID",
          values: [option.label],
        },
      ],
      isDisabled: Boolean(disabledReasons[option.value]),
      disabledReason: disabledReasons[option.value],
    };
  });

  return [...aliasOptions, ...labelAndSearchIndexOptions].sort(
    makeSortComparator(tokens)
  );
}

export function formatOptionLabel(
  option: { label: string },
  { context, inputValue }: { context: "menu" | "value"; inputValue: string }
) {
  if (context === "value") {
    return option.label;
  }

  const nonLabelProperties = (option as Option).nonLabelProperties;
  const disabledReason = (option as Option).disabledReason;

  const MaybeTooltip = ({ children }: { children: React.ReactNode }) => {
    if (!disabledReason) {
      return <div>{children}</div>;
    }

    return (
      <Tooltip
        id={`disabled-option-${option.label}`}
        className={styles.unblockable}
        content={<WordBreaker text={disabledReason} />}
        placement="top"
      >
        <span className={styles.disabledOption}>{children}</span>
      </Tooltip>
    );
  };

  const tokens = tokenize(inputValue);

  return (
    <div>
      <MaybeTooltip>
        <div
          style={{
            fontWeight: nonLabelProperties?.length ? "bold" : "normal",
          }}
        >
          <Highlighter
            text={option.label}
            style={{ color: disabledReason ? "inherit" : "black" }}
            termToHiglight={tokens}
            matchPartialTerms
          />
        </div>
      </MaybeTooltip>
      {nonLabelProperties?.map((match, i) => {
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i}>
            <MaybeTooltip>
              {match.property.replace(/^(.)/, (c: string) => c.toUpperCase())}:{" "}
              <Highlighter
                text={match.values.join(", ")}
                termToHiglight={tokens}
                matchPartialTerms
                style={{ color: disabledReason ? "inherit" : "black" }}
              />
            </MaybeTooltip>
          </div>
        );
      })}
    </div>
  );
}

export function toOutputValue(
  slice_type: string,
  selectedOption?: { label: string; value: string } | null
) {
  if (!selectedOption) {
    return null;
  }

  const { label, value } = selectedOption;

  return {
    context_type: slice_type,
    name: label || value,
    expr: { "==": [{ var: "entity_label" }, value] },
  };
}
