import React, { useMemo } from "react";
import { useAnnotationDatasets } from "../../utils/api-helpers";
import AnnotationSourceSelect from "./AnnotationSourceSelect";
import AnnotationSliceSelect from "./AnnotationSliceSelect";

interface Props {
  dimension_type: string;
  dataset_id: string | null;
  identifier: string | null;
  identifierLabel: string | null;
  onChangeSourceDataset: (
    dataset_id: string,
    identifier_type: "column" | "sample_id" | "feature_id"
  ) => void;
  onChangeAnnotationSlice: (identifier_type: string, label: string) => void;
  isClearable?: boolean;
  className?: string;
  removeWrapperDiv?: boolean;
  menuPortalTarget?: Element | null;
}

const Container = ({
  removeWrapperDiv,
  children,
  className = undefined,
}: {
  removeWrapperDiv: boolean;
  children: React.ReactNode;
  className?: string;
}) => {
  return removeWrapperDiv ? (
    children
  ) : (
    <div className={className}>{children}</div>
  );
};

function AnnotationSelect({
  dimension_type,
  dataset_id,
  identifier,
  identifierLabel,
  onChangeSourceDataset,
  onChangeAnnotationSlice,
  isClearable = false,
  className = undefined,
  removeWrapperDiv = false,
  menuPortalTarget = undefined,
}: Props) {
  const {
    axis,
    isLoadingAnnotationDatasets,
    metadataDataset,
    metadataIdColumn,
    annotationDatasets,
  } = useAnnotationDatasets(dimension_type);

  const isUnknownDataset = useMemo(() => {
    if (
      !annotationDatasets ||
      !dataset_id ||
      dataset_id === metadataDataset?.id
    ) {
      return false;
    }

    return !annotationDatasets.some(
      (d) => d.id === dataset_id || d.given_id === dataset_id
    );
  }, [annotationDatasets, metadataDataset, dataset_id]);

  return (
    <Container className={className} removeWrapperDiv={removeWrapperDiv}>
      <AnnotationSourceSelect
        axis={axis}
        isLoadingAnnotationDatasets={isLoadingAnnotationDatasets}
        metadataDataset={metadataDataset}
        annotationDatasets={annotationDatasets}
        value={dataset_id}
        onChange={onChangeSourceDataset}
        menuPortalTarget={menuPortalTarget}
      />
      <div style={{ width: removeWrapperDiv ? 300 : 0, height: 10 }} />
      <AnnotationSliceSelect
        axis={axis}
        isLoadingAnnotationDatasets={isLoadingAnnotationDatasets}
        metadataDataset={metadataDataset}
        metadataIdColumn={metadataIdColumn}
        annotationDatasets={annotationDatasets}
        dataset_id={dataset_id}
        value={
          isUnknownDataset && identifierLabel ? identifierLabel : identifier
        }
        onChange={onChangeAnnotationSlice}
        menuPortalTarget={menuPortalTarget}
        isClearable={isClearable}
      />
    </Container>
  );
}

export default AnnotationSelect;
