import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiContext, SharedApi } from "@depmap/api";
import { Highlighter, Tooltip, WordBreaker } from "@depmap/common-components";
import { fetchEntityToDatasetsMapping } from "../../../api";
import { getDimensionTypeLabel } from "../../../utils/misc";
import { SearchDimenionsResponse } from "@depmap/types";
import styles from "../../../styles/DimensionSelect.scss";

export type Aliases = {
  label: string;
  slice_id: string;
  values: string[];
}[];

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

export const getPlaceholder = (entity_type: string) => {
  return `Choose ${getDimensionTypeLabel(entity_type)}…`;
};

export function useApi() {
  const apiContext = useContext(ApiContext);
  const ref = useRef<SharedApi | null>(null);

  if (!ref.current) {
    ref.current = apiContext.getApi();
  }

  return ref.current as SharedApi;
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

async function fetchEntityLabelsAndAliases(
  entity_type: string | null,
  dataType: string | null,
  dataset_id: string | null,
  units: string | null
) {
  if (!entity_type) {
    return {
      entityLabels: [],
      aliases: [],
      disabledReasons: {},
    };
  }

  const mapping = await fetchEntityToDatasetsMapping(entity_type);
  const labels = Object.keys(mapping.entity_labels);
  const reasons: Record<string, string> = {};

  if (labels.length === 0) {
    return {
      entityLabels: [],
      aliases: [],
      disabledReasons: reasons,
    };
  }

  const dsIndex = mapping.dataset_ids.findIndex((id) => id === dataset_id);

  const typeIndices = dataType ? mapping.data_types[dataType] : [];
  const unitsIndices = units ? mapping.units[units] : [];

  Object.entries(mapping.entity_labels).forEach(([label, dsIndices]) => {
    if (units && doNotOverlap(unitsIndices, dsIndices)) {
      reasons[label] = [
        `This ${getDimensionTypeLabel(entity_type)}`,
        `has no “${units}” measurement`,
      ].join(" ");
    }

    if (dsIndex !== -1 && !dsIndices.includes(dsIndex)) {
      reasons[label] = [
        "The data version",
        `“${mapping.dataset_labels[dsIndex]}”`,
        "doesn’t include this",
        getDimensionTypeLabel(entity_type),
      ].join(" ");
    }

    if (dataType && doNotOverlap(typeIndices, dsIndices)) {
      reasons[label] = [
        `The data type “${dataType}”`,
        "has no data versions with this",
        getDimensionTypeLabel(entity_type),
      ].join(" ");
    }
  });

  return {
    entityLabels: labels,
    aliases: mapping.aliases,
    disabledReasons: reasons,
  };
}

export function useEntityLabels(
  entity_type: string | null,
  dataType: string | null,
  dataset_id: string | null,
  units: string | null
) {
  const [error, setError] = useState(false);
  const [entityLabels, setEntityLabels] = useState<string[] | null>(null);
  const [aliases, setAliases] = useState<Aliases | null>(null);
  const [disabledReasons, setDisabledReasons] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setEntityLabels(null);
    setError(false);

    (async () => {
      if (entity_type) {
        try {
          const fetchedData = await fetchEntityLabelsAndAliases(
            entity_type,
            dataType,
            dataset_id,
            units
          );

          setEntityLabels(fetchedData.entityLabels);
          setAliases(fetchedData.aliases);
          setDisabledReasons(fetchedData.disabledReasons);
        } catch (e) {
          setError(true);
          window.console.error(e);
        }
      }
    })();
  }, [entity_type, dataType, dataset_id, units]);

  const waitForCachedValues = useCallback(() => {
    return fetchEntityLabelsAndAliases(
      entity_type,
      dataType,
      dataset_id,
      units
    );
  }, [entity_type, dataType, dataset_id, units]);

  return {
    aliases,
    disabledReasons,
    entityLabels,
    error,
    waitForCachedValues,
  };
}

const makeSortComparator = (term: string | null) => (a: Option, b: Option) => {
  if (a.isDisabled && !b.isDisabled) {
    return 1;
  }

  if (!a.isDisabled && b.isDisabled) {
    return -1;
  }

  const labelA = (a.nonLabelProperties[0]?.values[0] || a.label)?.toLowerCase();
  const labelB = (b.nonLabelProperties[0]?.values[0] || b.label)?.toLowerCase();

  if (!term) {
    return labelA < labelB ? -1 : 1;
  }

  const indexA = labelA.indexOf(term);
  const indexB = labelB.indexOf(term);

  if (indexA === indexB) {
    return labelA < labelB ? -1 : 1;
  }

  return indexA < indexB ? -1 : 1;
};

export function toReactSelectOptions(
  searchResults: SearchDimenionsResponse,
  inputValue: string | null,
  entityLabels: string[],
  disabledReasons: Record<string, string>
) {
  const term = inputValue?.toLowerCase() || null;

  const labelOptions = entityLabels
    .filter((label) => {
      return !term || label.toLowerCase().includes(term);
    })
    .map((label) => ({
      label,
      value: label,
      nonLabelProperties: [],
      isDisabled: Boolean(disabledReasons[label]),
      disabledReason: disabledReasons[label],
    }));

  const labels = new Set(entityLabels);

  const searchIndexOptions = searchResults
    .filter((result) => labels.has(result.label))
    .filter((result) => {
      return (
        result.matching_properties.length > 1 ||
        result.matching_properties[0].property !== "label"
      );
    })
    .map((result) => {
      const groupedProps: Record<string, string[]> = {};

      result.matching_properties.forEach(({ property, value }) => {
        const prop = property
          // no underscores
          .replace(/_/g, " ")
          // capitalize "ID"
          .replace(/\bids?\b/gi, "ID")
          // A second-level "label" property is not interesting
          .replace(/\.label$/, "")
          // Use parens instead of dot notation for other second-level properties
          .replace(/\.(.+)$/, " ($1)");

        groupedProps[prop] ||= [];
        groupedProps[prop].push(value);
      });

      const nonLabelProperties = Object.keys(groupedProps)
        .filter((property) => property !== "label")
        .map((property) => ({
          property,
          values: groupedProps[property],
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
    makeSortComparator(term)
  );
}

export function toDemapModelOptions(
  searchResults: SearchDimenionsResponse,
  inputValue: string | null,
  entityLabels: string[],
  aliases: Aliases | null,
  disabledReasons: Record<string, string>
) {
  const term = inputValue?.toLowerCase() || null;
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};

  if (aliases && aliases.length > 0) {
    entityLabels.forEach((label, i) => {
      const alias = aliases![0].values[i];
      nameToId[alias] = label;
      idToName[label] = alias;
    });
  }

  const aliasOptions =
    aliases && aliases.length > 0
      ? aliases![0].values
          .filter((cellLineName) => {
            return (
              (!term && cellLineName) ||
              (term && cellLineName?.toLowerCase().includes(term))
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
          .sort((a, b) => (a.label < b.label ? -1 : 1))
      : [];

  const labelAndSearchIndexOptions = toReactSelectOptions(
    searchResults,
    inputValue,
    entityLabels,
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
    makeSortComparator(term)
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
        id="disabled-data-type"
        className={styles.unblockable}
        content={<WordBreaker text={disabledReason} />}
        placement="top"
      >
        <span style={{ cursor: "not-allowed" }}>{children}</span>
      </Tooltip>
    );
  };

  return (
    <div>
      <MaybeTooltip>
        {nonLabelProperties?.length ? (
          <b>{option.label}</b>
        ) : (
          <Highlighter
            text={option.label}
            termToHiglight={inputValue}
            matchPartialTerms
            textColor={disabledReason ? "inherit" : "black"}
          />
        )}
      </MaybeTooltip>
      {nonLabelProperties?.map((match) => {
        return (
          <div key={`${match.property}=${match.values}`}>
            <MaybeTooltip>
              {match.property.replace(/^(.)/, (c: string) => c.toUpperCase())}:{" "}
              <Highlighter
                text={match.values.join(", ")}
                termToHiglight={inputValue}
                matchPartialTerms
                textColor={disabledReason ? "inherit" : "black"}
              />
            </MaybeTooltip>
          </div>
        );
      })}
    </div>
  );
}

export function toOutputValue(
  entity_type: string,
  selectedOption?: { label: string; value: string } | null
) {
  if (!selectedOption) {
    return null;
  }

  const { label, value } = selectedOption;

  return {
    context_type: entity_type,
    name: label || value,
    expr: { "==": [{ var: "entity_label" }, value] },
  };
}
