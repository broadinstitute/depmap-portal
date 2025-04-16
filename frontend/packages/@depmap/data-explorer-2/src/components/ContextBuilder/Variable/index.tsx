import React, { useMemo } from "react";
import { capitalize, getDimensionTypeLabel } from "../../../utils/misc";
import { DeprecatedDataExplorerApiResponse } from "../../../contexts/DeprecatedDataExplorerApiContext";
import SliceLabelSelector from "../../SliceLabelSelector";
import { ContextBuilderReducerAction } from "../contextBuilderReducer";
import { getValueType, makePartialSliceId } from "../contextBuilderUtils";
import { useContextBuilderContext } from "../ContextBuilderContext";
import VariableEntity from "./VariableEntity";
import DataSourceSelect from "./DataSourceSelect";
import SlicePrefixSelect from "./SlicePrefixSelect";
import styles from "../../../styles/ContextBuilder.scss";

type SliceId = string;

interface Props {
  // HACK: This temp property fills a hole in the data model. We're
  // dependent on a slice ID (or at least part of one) to figure out what
  // "source" (annotation vs matrix dataset) the selected dataset comes
  // from. Because we first prompt the user to choose a data source, so
  // we need a placeholder to keep track of that selection.
  placeholderDataSource: string | null;
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

const inferDataSource = (
  value: string | null,
  metadataSlices: DeprecatedDataExplorerApiResponse["fetchMetadataSlices"],
  isPartialContinuousSliceId: boolean,
  isPartialCategoricalSliceId: boolean,
  isOneHotEncodedAnnotation: boolean
) => {
  if (value === SLICE_LABEL_VARIABLE || isPartialCategoricalSliceId) {
    return "legacy_metadata_slice";
  }

  const slice = value && metadataSlices[value];

  if (slice && !slice.isBreadboxMetadata) {
    return "legacy_metadata_slice";
  }

  if (slice && slice.isBreadboxMetadata) {
    return "breadbox_metadata_column";
  }

  if (isPartialContinuousSliceId) {
    return "matrix_dataset";
  }

  if (isOneHotEncodedAnnotation) {
    return "breadbox_metadata_column";
  }

  return null;
};

function Variable({
  placeholderDataSource,
  value,
  path,
  onChangeDataSelect,
  dispatch,
  slice_type,
  shouldShowValidation,
}: Props) {
  const { datasets, metadataSlices } = useContextBuilderContext();

  const continuousDatasetSliceLookupTable = useMemo(
    () =>
      (datasets || [])
        .filter((d) => {
          const psid = makePartialSliceId(d.given_id || d.id);
          if (metadataSlices[psid]?.valueType === "binary") {
            return false;
          }

          return true;
        })
        .reduce(
          (memo, d) => ({
            ...memo,
            [makePartialSliceId(d.given_id || d.id)]: d.name,
          }),
          {}
        ),
    [datasets, metadataSlices]
  );

  const continuousDatasetDataTypes = useMemo(
    () =>
      (datasets || [])
        .filter((d) => {
          const psid = makePartialSliceId(d.given_id || d.id);
          if (metadataSlices[psid]?.valueType === "binary") {
            return false;
          }

          return true;
        })
        .reduce(
          (memo, d) => ({
            ...memo,
            [makePartialSliceId(d.given_id || d.id)]: d.data_type,
          }),
          {}
        ),
    [datasets, metadataSlices]
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
  const isPartialContinuousSliceId = Boolean(
    findSliceId(value, continuousDatasetSliceLookupTable)
  );

  const psid = findSliceId(value, metadataSlices);
  const isPartialCategoricalSliceId = Boolean(
    psid &&
      metadataSlices[psid]?.isPartialSliceId &&
      ["categorical", "list_strings"].includes(metadataSlices[psid]?.valueType)
  );

  const isOneHotEncodedAnnotation = Boolean(
    psid && metadataSlices[psid]?.valueType === "binary"
  );

  const valueOrPartialSlice =
    isPartialContinuousSliceId ||
    isPartialCategoricalSliceId ||
    isOneHotEncodedAnnotation
      ? findSliceId(value, variables)
      : value;

  const varDatasetId = extractDatasetIdFromSlice(value, variables);

  const varSliceType = datasets?.find((d) => d.id === varDatasetId)?.slice_type;

  const dataSource = (placeholderDataSource ||
    inferDataSource(
      value,
      metadataSlices,
      isPartialContinuousSliceId,
      isPartialCategoricalSliceId,
      isOneHotEncodedAnnotation
    )) as
    | "legacy_metadata_slice"
    | "breadbox_metadata_column"
    | "matrix_dataset"
    | null;

  return (
    <div>
      <DataSourceSelect
        isLoading={!datasets}
        slice_type={slice_type}
        value={dataSource}
        onChange={(nextDataSource) => {
          dispatch({
            type: "update-value",
            payload: {
              path: path.slice(0, -2),
              value: {
                "==": [{ placeholderDataSource: nextDataSource }, null],
              },
            },
          });
        }}
      />
      {dataSource && (
        <SlicePrefixSelect
          dataSource={dataSource}
          onChangeDataSelect={onChangeDataSelect}
          shouldShowValidation={shouldShowValidation}
          slice_type={slice_type}
          valueOrPartialSlice={valueOrPartialSlice}
          continuousDatasetSliceLookupTable={continuousDatasetSliceLookupTable}
          continuousDatasetDataTypes={continuousDatasetDataTypes}
        />
      )}
      {isPartialContinuousSliceId && (
        <VariableEntity
          value={value}
          path={path}
          dispatch={dispatch}
          dataset_id={varDatasetId as string}
          slice_type={varSliceType as string}
          shouldShowValidation={shouldShowValidation}
        />
      )}
      {isPartialCategoricalSliceId && (
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
