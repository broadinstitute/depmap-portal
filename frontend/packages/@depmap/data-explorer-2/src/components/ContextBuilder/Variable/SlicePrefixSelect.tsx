import React, { useMemo } from "react";
import { capitalize, getDimensionTypeLabel } from "../../../utils/misc";
import { makeSliceComparator } from "../../DatasetMetadataSelector/utils";
import PlotConfigSelect from "../../PlotConfigSelect";
import { useContextBuilderContext } from "../ContextBuilderContext";
import styles from "../../../styles/ContextBuilder.scss";

interface Props {
  dataSource:
    | "legacy_metadata_slice"
    | "breadbox_metadata_column"
    | "matrix_dataset"
    | null;
  onChangeDataSelect: (option: { label: string; value: string } | null) => void;
  shouldShowValidation: boolean;
  slice_type: string;
  valueOrPartialSlice: string | null;
  continuousDatasetSliceLookupTable: Record<string, string>;
  continuousDatasetDataTypes: Record<string, string>;
}

// These day we're referring to these as slice labels, but the constant
// "entity_label" needs to be used for compatibility with old contexts.
const SLICE_LABEL_VARIABLE = "entity_label";

function SlicePrefixSelect({
  onChangeDataSelect,
  shouldShowValidation,
  slice_type,
  dataSource,
  valueOrPartialSlice,
  continuousDatasetSliceLookupTable,
  continuousDatasetDataTypes,
}: Props) {
  const { metadataSlices, isLoading } = useContextBuilderContext();

  const variables = useMemo(() => {
    const out: Record<string, string> = {};

    if (dataSource === "matrix_dataset") {
      Object.entries(continuousDatasetSliceLookupTable).forEach(
        ([key, value]) => {
          out[key] = value;
        }
      );
    }

    if (dataSource === "legacy_metadata_slice") {
      let slice_label = `${capitalize(getDimensionTypeLabel(slice_type))} name`;

      if (slice_type === "depmap_model") {
        slice_label = "Depmap ID";
      }

      if (slice_type === "compound_experiment") {
        slice_label = "Compound/experiment ID";
      }

      out[SLICE_LABEL_VARIABLE] = slice_label;
    }

    const compare = makeSliceComparator(metadataSlices);

    Object.entries(metadataSlices)
      .filter(([, value]) => {
        return value.isBreadboxMetadata
          ? dataSource === "breadbox_metadata_column"
          : dataSource === "legacy_metadata_slice";
      })
      .sort((a, b) => compare(a[0], b[0]))
      .forEach(([key, value]) => {
        out[key] = value.name;
      });

    return out;
  }, [
    continuousDatasetSliceLookupTable,
    metadataSlices,
    slice_type,
    dataSource,
  ]);

  const options = useMemo(() => {
    if (dataSource === "matrix_dataset") {
      const groups: Record<string, string[]> = {};

      Object.entries(continuousDatasetDataTypes).forEach(
        ([sliceId, dataType]) => {
          groups[dataType] ||= [];
          groups[dataType].push(sliceId);
        }
      );

      return Object.entries(groups).map(([dataType, sliceIds]) => {
        const optionsByDataType = sliceIds.map((sliceId) => {
          return { value: sliceId, label: variables[sliceId] };
        });

        return { label: dataType, options: optionsByDataType };
      });
    }

    return Object.entries(variables).map(([value, label]) => ({
      value,
      label,
    }));
  }, [continuousDatasetDataTypes, dataSource, variables]);

  return (
    <PlotConfigSelect
      show
      enable={!isLoading}
      className={styles.varSelect}
      hasError={shouldShowValidation && !valueOrPartialSlice}
      isLoading={isLoading}
      value={
        valueOrPartialSlice
          ? {
              value: valueOrPartialSlice,
              label: variables[valueOrPartialSlice] || "(unknown property)",
            }
          : null
      }
      options={options}
      onChange={onChangeDataSelect as () => void}
      onChangeUsesWrappedValue
      placeholder="Select data…"
      menuPortalTarget={document.querySelector("#modal-container")}
    />
  );
}

export default SlicePrefixSelect;
