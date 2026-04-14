import { useDimensionType } from "../../../utils/misc";

/**
 * Computes the label and placeholder for the extracted SliceSelect
 * based on the index_type and slice_type. This replaces the useLabel
 * and usePlaceholder hooks that were previously internal to SliceSelect.
 */
export default function useSliceSelectLabels(
  index_type: string | null | undefined,
  slice_type: string | null | undefined
) {
  // The label is the "other axis" — if index_type is a sample type,
  // the slice axis is feature, so the label is "Feature".
  const { dimensionType: indexDimType } = useDimensionType(index_type);

  // The placeholder uses the slice_type's display name.
  const { dimensionType: sliceDimType } = useDimensionType(
    typeof slice_type === "string" ? slice_type : null
  );

  let label = "Dimension";

  if (indexDimType) {
    label = indexDimType.axis === "sample" ? "Feature" : "Sample";
  }

  let placeholder = "Select…";

  if (sliceDimType) {
    placeholder = `Choose ${sliceDimType.display_name}…`;
  }

  return { label, placeholder };
}
