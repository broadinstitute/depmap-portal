import React, { useEffect, useMemo } from "react";
import { Dataset, TabularDataset } from "@depmap/types";
import PlotConfigSelect from "../PlotConfigSelect";
import showAnnotationDetailsModal from "./showAnnotationDetailsModal";

interface Props {
  axis: "sample" | "feature" | undefined;
  isLoadingAnnotationDatasets: boolean;
  metadataDataset: TabularDataset | undefined;
  annotationDatasets: Dataset[];
  value: string | null;
  onChange: (
    dataset_id: string,
    identifier_type: "column" | "sample_id" | "feature_id"
  ) => void;
  hiddenDatasets?: Set<string>;
  menuPortalTarget?: Element | null;
}

const EMPTY_SET = new Set<string>();

function AnnotationSourceSelect({
  axis,
  isLoadingAnnotationDatasets,
  metadataDataset,
  annotationDatasets,
  value,
  onChange,
  hiddenDatasets = EMPTY_SET,
  menuPortalTarget = undefined,
}: Props) {
  const annotationSourceOptions = useMemo(() => {
    const opts: {
      value: string;
      label: string;
      identifier_type: string;
    }[] = [];

    if (!metadataDataset) {
      return opts;
    }

    const oppositeAxis = axis === "sample" ? "feature" : "sample";

    if (
      !hiddenDatasets.has(metadataDataset.id) &&
      (!metadataDataset.given_id ||
        !hiddenDatasets.has(metadataDataset.given_id))
    ) {
      opts.push({
        value: metadataDataset.given_id || metadataDataset.id,
        label: "Primary annotations",
        identifier_type: "column",
      });
    }

    for (const { name, id, given_id, format } of annotationDatasets) {
      if (hiddenDatasets.has(id)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (given_id && hiddenDatasets.has(given_id)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      opts.push({
        label: name,
        value: given_id || id,
        identifier_type:
          format === "matrix_dataset" ? `${oppositeAxis}_id` : "column",
      });
    }

    return opts;
  }, [annotationDatasets, axis, hiddenDatasets, metadataDataset]);

  // Initialize with a default value if possible
  useEffect(() => {
    if (!value && annotationSourceOptions.length > 0) {
      onChange(annotationSourceOptions[0].value, "column");
    }
  }, [annotationSourceOptions, onChange, value]);

  let displayValue = value as string | null | { value: string; label: string };

  if (isLoadingAnnotationDatasets) {
    displayValue = { value: value as string, label: "Loading..." };
  }

  return (
    <PlotConfigSelect
      show
      label="Annotation Source"
      renderDetailsButton={() => (
        <button
          type="button"
          disabled={!value}
          onClick={() => {
            showAnnotationDetailsModal(value!);
          }}
        >
          details
        </button>
      )}
      value={displayValue}
      enable={!isLoadingAnnotationDatasets}
      isLoading={isLoadingAnnotationDatasets}
      options={annotationSourceOptions}
      onChangeUsesWrappedValue
      onChange={(wrappedValue) => {
        const {
          value: dataset_id,
          identifier_type,
        } = (wrappedValue as unknown) as {
          value: string;
          identifier_type: "column" | "sample_id" | "feature_id";
        };

        onChange(dataset_id, identifier_type);
      }}
      menuPortalTarget={menuPortalTarget}
    />
  );
}

export default AnnotationSourceSelect;
