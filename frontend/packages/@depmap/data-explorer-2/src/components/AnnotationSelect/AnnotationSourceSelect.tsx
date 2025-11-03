import React, { useMemo } from "react";
import { Dataset, TabularDataset } from "@depmap/types";
import PlotConfigSelect from "../PlotConfigSelect";
import showAnnotationDetailsModal from "./showAnnotationDetailsModal";
import styles from "../../styles/DimensionSelect.scss";

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
  menuPortalTarget?: Element | null;
}

function AnnotationSourceSelect({
  axis,
  isLoadingAnnotationDatasets,
  metadataDataset,
  annotationDatasets,
  value,
  onChange,
  menuPortalTarget = undefined,
}: Props) {
  const annotationSourceOptions = useMemo(() => {
    if (!metadataDataset) {
      return [];
    }

    const oppositeAxis = axis === "sample" ? "feature" : "sample";

    return [
      {
        value: metadataDataset.given_id,
        label: "Primary annotations",
        identifier_type: "column",
      },
      ...annotationDatasets.map(({ name, id, given_id, format }) => ({
        label: name,
        value: given_id || id,
        identifier_type:
          format === "matrix_dataset" ? `${oppositeAxis}_id` : "column",
      })),
    ];
  }, [annotationDatasets, axis, metadataDataset]);

  return (
    <PlotConfigSelect
      show
      label={
        <span className={styles.labelWithDetailsButton}>
          Annotation Source
          <button
            type="button"
            className={styles.detailsButton}
            disabled={!value}
            onClick={() => {
              showAnnotationDetailsModal(value!);
            }}
          >
            details
          </button>
        </span>
      }
      value={value}
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
