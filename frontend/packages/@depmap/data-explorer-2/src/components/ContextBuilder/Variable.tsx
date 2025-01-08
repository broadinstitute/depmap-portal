import React, { useEffect, useMemo, useState } from "react";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import { capitalize, getDimensionTypeLabel } from "../../utils/misc";
import {
  DeprecatedDataExplorerApiResponse,
  useDeprecatedDataExplorerApi,
} from "../../contexts/DeprecatedDataExplorerApiContext";
import SliceLabelSelector from "../SliceLabelSelector";
import PlotConfigSelect from "../PlotConfigSelect";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import { getValueType, makePartialSliceId } from "./contextBuilderUtils";
import { useContextBuilderContext } from "./ContextBuilderContext";
import VariableEntity from "./VariableEntity";
import styles from "../../styles/ContextBuilder.scss";

type SliceId = string;

interface Props {
  value: "entity_label" | SliceId | null;
  path: (string | number)[];
  onChangeDataSelect: (option: { label: string; value: string } | null) => void;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  slice_type: string;
  shouldShowValidation: boolean;
}

// These day we're referring to these as slice labels, but the constant
// "entity_label" needs to be used for compatibility with old contexts.
const SLICE_LABEL_VARIABLE = "entity_label";

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

const getMetadataLookupTable = (
  slices: DeprecatedDataExplorerApiResponse["fetchMetadataSlices"]
) => {
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

function Variable({
  value,
  path,
  onChangeDataSelect,
  dispatch,
  slice_type,
  shouldShowValidation,
}: Props) {
  const api = useDeprecatedDataExplorerApi();

  const [datasets, setDatasets] = useState<
    DataExplorerDatasetDescriptor[] | null
  >(null);

  const { metadataSlices, isLoading } = useContextBuilderContext();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await api.fetchDatasetsByIndexType();
        const fetchedDatasets = data?.[slice_type] || [];
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
  }, [api, slice_type]);

  const continuousDatasetSliceLookupTable = useMemo(
    () =>
      (datasets || []).reduce(
        (memo, dataset) => ({
          ...memo,
          [makePartialSliceId(dataset.id)]: dataset.name,
        }),
        {}
      ),
    [datasets]
  );

  const variables: Record<string, string> = useMemo(() => {
    let slice_label = `${capitalize(getDimensionTypeLabel(slice_type))} name`;

    if (slice_type === "depmap_model") {
      slice_label = "Depmap ID";
    }

    if (slice_type === "compound_experiment") {
      slice_label = "Compound/experiment ID";
    }

    return {
      [SLICE_LABEL_VARIABLE]: slice_label,
      ...getMetadataLookupTable(metadataSlices),
      ...(continuousDatasetSliceLookupTable || {}),
    };
  }, [continuousDatasetSliceLookupTable, slice_type, metadataSlices]);

  // A partial slice is used to select the dataset only.
  // A complete slice also contains a specific feature.
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

  const varSliceType = datasets?.find((d) => d.id === varDatasetId)?.slice_type;

  return (
    <div>
      <PlotConfigSelect
        show
        enable={!isLoading && Boolean(continuousDatasetSliceLookupTable)}
        className={styles.varSelect}
        hasError={shouldShowValidation && !valueOrPartialSlice}
        isLoading={isLoading || !continuousDatasetSliceLookupTable}
        value={
          valueOrPartialSlice
            ? {
                value: valueOrPartialSlice,
                label: variables[valueOrPartialSlice] || "(unknown property)",
              }
            : null
        }
        options={toOptions(variables)}
        onChange={onChangeDataSelect as () => void}
        onChangeUsesWrappedValue
        placeholder="Select data…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
      {isParitalContinuousSliceId && (
        <VariableEntity
          value={value}
          path={path}
          dispatch={dispatch}
          dataset_id={varDatasetId as string}
          slice_type={varSliceType as string}
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
            sliceTypeLabel={
              metadataSlices[valueOrPartialSlice!].sliceTypeLabel as string
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
