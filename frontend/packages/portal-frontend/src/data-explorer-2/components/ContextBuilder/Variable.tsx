import React, { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import Select, { createFilter } from "react-windowed-select";
import {
  capitalize,
  fetchDatasetsByIndexType,
  getDimensionTypeLabel,
  MetadataSlices,
  SliceLabelSelector,
} from "@depmap/data-explorer-2";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import { useContextBuilderContext } from "src/data-explorer-2/components/ContextBuilder/ContextBuilderContext";
import { ContextBuilderReducerAction } from "src/data-explorer-2/components/ContextBuilder/contextBuilderReducer";
import {
  getValueType,
  makePartialSliceId,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";
import VariableEntity from "src/data-explorer-2/components/ContextBuilder/VariableEntity";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

type SliceId = string;

interface Props {
  value: "entity_label" | SliceId | null;
  path: (string | number)[];
  onChangeDataSelect: (option: { label: string; value: string } | null) => void;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  entity_type: string;
  shouldShowValidation: boolean;
}

const findSliceId = (
  value: string | null,
  sliceVariables: Record<string, unknown>
) => {
  if (value && sliceVariables) {
    const sliceIds = Object.keys(sliceVariables);

    for (let i = 0; i < sliceIds.length; i += 1) {
      if (value.includes(sliceIds[i])) {
        return sliceIds[i];
      }
    }
  }

  return null;
};

const extractDatasetIdFromSlice = (
  slice_id: string | null,
  sliceVariables: Record<string, unknown>
) => {
  if (!slice_id) {
    return null;
  }

  const match = findSliceId(slice_id, sliceVariables);

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.replace("slice/", "").slice(0, -1));
};

const getMetadataLookupTable = (slices: MetadataSlices) => {
  const out: Record<string, string> = {};

  Object.entries(slices).forEach(([key, value]) => {
    out[key] = value.name;
  });

  return out;
};

const toOptions = (variables: Record<string, string>) =>
  Object.entries(variables).map(([value, label]) => ({
    value,
    label,
  }));

const selectStyles = {
  control: (base: object) => ({
    ...base,
    fontSize: 13,
  }),
  menu: (base: object) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: "max-content",
  }),
};

function Variable({
  value,
  path,
  onChangeDataSelect,
  dispatch,
  entity_type,
  shouldShowValidation,
}: Props) {
  const [datasets, setDatasets] = useState<
    DataExplorerDatasetDescriptor[] | null
  >(null);

  const { metadataSlices, isLoading } = useContextBuilderContext();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchDatasetsByIndexType();
        const fetchedDatasets = data?.[entity_type] || [];
        if (mounted) {
          setDatasets(fetchedDatasets);
        }
      } catch (e) {
        window.console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [entity_type]);

  const continuousDatasetSliceLookupTable = useMemo(
    () =>
      (datasets || []).reduce(
        (memo, dataset) => ({
          ...memo,
          [makePartialSliceId(dataset.dataset_id)]: dataset.label,
        }),
        {}
      ),
    [datasets]
  );

  const variables: Record<string, string> = useMemo(() => {
    let entity_label = `${capitalize(getDimensionTypeLabel(entity_type))} name`;

    if (entity_type === "depmap_model") {
      entity_label = "Depmap ID";
    }

    if (entity_type === "compound_experiment") {
      entity_label = "Compound/experiment ID";
    }

    return {
      entity_label,
      ...getMetadataLookupTable(metadataSlices),
      ...(continuousDatasetSliceLookupTable || {}),
    };
  }, [continuousDatasetSliceLookupTable, entity_type, metadataSlices]);

  // A partial slice is used to select the dataset only.
  // A complete slice also contains a specific entity.
  const isParitalContinuousSliceId = Boolean(
    findSliceId(value, continuousDatasetSliceLookupTable)
  );

  const psid = findSliceId(value, metadataSlices);
  const isParitalCategoricalSliceId =
    !!psid && !!metadataSlices[psid]?.isPartialSliceId;

  const valueOrPartialSlice =
    isParitalContinuousSliceId || isParitalCategoricalSliceId
      ? findSliceId(value, variables)
      : value;

  const varDatasetId = extractDatasetIdFromSlice(value, variables);

  const varEntityType = datasets?.find((d) => d.dataset_id === varDatasetId)
    ?.entity_type;

  return (
    <div>
      <Select
        className={cx(styles.varSelect, {
          [styles.invalidSelect]: shouldShowValidation && !valueOrPartialSlice,
        })}
        styles={selectStyles}
        isLoading={isLoading || !continuousDatasetSliceLookupTable}
        isDisabled={isLoading || !continuousDatasetSliceLookupTable}
        value={
          valueOrPartialSlice && {
            value: valueOrPartialSlice,
            label: variables[valueOrPartialSlice] || "(unknown property)",
          }
        }
        options={toOptions(variables)}
        onChange={onChangeDataSelect}
        placeholder="Select data…"
        menuPortalTarget={document.querySelector("#modal-container")}
        // See https://github.com/JedWatson/react-select/issues/3403#issuecomment-480183854
        filterOption={createFilter({
          matchFrom: "any",
          stringify: (option) => `${option.label}`,
        })}
      />
      {isParitalContinuousSliceId && (
        <VariableEntity
          value={value}
          path={path}
          dispatch={dispatch}
          dataset_id={varDatasetId as string}
          entity_type={varEntityType as string}
          shouldShowValidation={shouldShowValidation}
        />
      )}
      {isParitalCategoricalSliceId && (
        <div className={styles.sliceLabelSelector}>
          <SliceLabelSelector
            value={value ? decodeURIComponent(value.split("/")[2]) : null}
            onChange={(nextSliceId) => {
              const nextValueType = getValueType(metadataSlices, nextSliceId);
              const op = nextValueType === "list_strings" ? "has_any" : "==";

              dispatch({
                type: "update-value",
                payload: {
                  path: path.slice(0, -2),
                  value: { [op]: [{ var: nextSliceId }, null] },
                },
              });
            }}
            dataset_id={varDatasetId as string}
            entityTypeLabel={
              metadataSlices[valueOrPartialSlice!].entityTypeLabel as string
            }
            menuPortalTarget={document.querySelector("#modal-container")}
            isClearable={false}
          />
        </div>
      )}
    </div>
  );
}

export default Variable;
