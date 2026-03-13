import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { Dataset, TabularDataset } from "@depmap/types";
import PlotConfigSelect from "../PlotConfigSelect";

interface Props {
  axis: "sample" | "feature" | undefined;
  isLoadingAnnotationDatasets: boolean;
  metadataDataset: TabularDataset | undefined;
  metadataIdColumn: string | undefined;
  annotationDatasets: Dataset[];
  dataset_id: string | null;
  value: string | null;
  onChange: (identifier_type: string, label: string) => void;
  isClearable: boolean;
  // FIXME: This should probably be a set of SliceQueries instead of just
  // strings (the same column name could appear in multiple tables).
  disabledAnnotations?: Set<string>;
  // FIXME: Same issue as `disabledAnnotations`
  hiddenAnnotations?: Set<string>;
  menuPortalTarget?: Element | null;
}

const disabledOptionsLast = (
  a: { isDisabled: boolean | undefined },
  b: typeof a
) => {
  if (a.isDisabled === b.isDisabled) {
    return 0;
  }

  return a.isDisabled ? 1 : -1;
};

function AnnotationSliceSelect({
  axis,
  isLoadingAnnotationDatasets,
  metadataDataset,
  metadataIdColumn,
  annotationDatasets,
  dataset_id,
  value,
  onChange,
  isClearable,
  disabledAnnotations = undefined,
  hiddenAnnotations = undefined,
  menuPortalTarget = undefined,
}: Props) {
  const [isLoadingProperties, setIsLoadingProperites] = useState(false);
  const [sliceTypeDisplayName, setSliceTypeDisplayName] = useState<
    string | null
  >(null);

  const [propertyOptions, setPropertyOptions] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    if (!axis || !metadataDataset || !dataset_id) {
      setPropertyOptions([]);
      setSliceTypeDisplayName(null);
      setIsLoadingProperites(false);
    }
  }, [axis, metadataDataset, dataset_id]);

  useEffect(() => {
    if (!axis || !metadataDataset || !dataset_id) {
      return;
    }

    if (
      dataset_id !== metadataDataset.id &&
      dataset_id !== metadataDataset.given_id
    ) {
      return;
    }

    const nextPropOpts = Object.entries(metadataDataset.columns_metadata)
      .sort(([colA], [colB]) => {
        if (colA === metadataIdColumn) {
          return -1;
        }

        if (colB === metadataIdColumn) {
          return 1;
        }

        if (colA === "label") {
          return -1;
        }

        return 0;
      })
      .filter(([columnName]) => !hiddenAnnotations?.has(columnName))
      .map(([columnName]) => ({
        label: columnName,
        value: columnName,
        isDisabled: disabledAnnotations?.has(columnName),
      }))
      .sort(disabledOptionsLast);

    setPropertyOptions(nextPropOpts);
    setSliceTypeDisplayName(null);
    setIsLoadingProperites(false);
  }, [
    axis,
    annotationDatasets,
    dataset_id,
    disabledAnnotations,
    hiddenAnnotations,
    metadataDataset,
    metadataIdColumn,
  ]);

  useEffect(() => {
    if (!axis || !metadataDataset || !dataset_id) {
      return;
    }

    if (
      dataset_id === metadataDataset.id ||
      dataset_id === metadataDataset.given_id
    ) {
      return;
    }

    const selectedDataset = annotationDatasets.find(
      ({ id, given_id }) => dataset_id === id || dataset_id === given_id
    )!;

    if (!selectedDataset) {
      setPropertyOptions([]);
      setSliceTypeDisplayName(null);
      setIsLoadingProperites(false);
      return;
    }

    if (selectedDataset.format === "matrix_dataset") {
      setIsLoadingProperites(true);

      const getFeaturesOrSamples =
        axis === "feature"
          ? cached(breadboxAPI).getDatasetSamples
          : cached(breadboxAPI).getDatasetFeatures;

      getFeaturesOrSamples(selectedDataset.id).then((featuresOrSamples) => {
        setPropertyOptions(
          featuresOrSamples.map(({ id, label }) => ({ value: id, label }))
        );
        setIsLoadingProperites(false);
      });

      if (axis === "feature" || selectedDataset.feature_type_name !== null) {
        const oppositeAxis = axis === "sample" ? "feature" : "sample";
        const oppositeDimTypeName = `${oppositeAxis}_type_name` as const;
        const oppositeDimType = selectedDataset[oppositeDimTypeName];

        cached(breadboxAPI)
          .getDimensionType(oppositeDimType)
          .then((dimType) => {
            setSliceTypeDisplayName(dimType.display_name);
          });
      } else {
        setSliceTypeDisplayName(null);
      }
    } else {
      setIsLoadingProperites(true);

      cached(breadboxAPI)
        .getDataset(selectedDataset.id)
        .then((dataset) => {
          const { columns_metadata } = dataset as TabularDataset;

          const nextPropOpts = Object.entries(columns_metadata)
            .filter(([columnName]) => !hiddenAnnotations?.has(columnName))
            .map(([columnName]) => ({
              label: columnName,
              value: columnName,
              isDisabled: disabledAnnotations?.has(columnName),
            }))
            .sort(disabledOptionsLast);

          setPropertyOptions(nextPropOpts);
          setSliceTypeDisplayName(null);
          setIsLoadingProperites(false);
        });
    }
  }, [
    axis,
    annotationDatasets,
    dataset_id,
    disabledAnnotations,
    hiddenAnnotations,
    metadataDataset,
    metadataIdColumn,
  ]);

  return (
    <PlotConfigSelect
      show
      isClearable={isClearable}
      label="Annotation"
      enable={!isLoadingAnnotationDatasets && !isLoadingProperties}
      isLoading={isLoadingAnnotationDatasets || isLoadingProperties}
      value={value}
      options={propertyOptions}
      onChangeUsesWrappedValue
      onChange={(wrappedValue) => {
        if (!wrappedValue) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange(null as any, null as any);
          return;
        }

        const { value: identifier, label } = (wrappedValue as unknown) as {
          value: string;
          label: string;
        };

        onChange(identifier, label);
      }}
      placeholder={`Choose ${sliceTypeDisplayName || "annotation"}…`}
      menuPortalTarget={menuPortalTarget}
    />
  );
}

export default AnnotationSliceSelect;
