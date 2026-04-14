export interface SliceSelection {
  id: string;
  label: string;
}

export interface SliceSelectProps {
  /**
   * The dimension type name to search within (e.g., "gene", "depmap_model").
   * When undefined and `isDatasetSpecificSlice` is false, the component
   * renders nothing.
   */
  slice_type?: string;

  /**
   * Set to true when the dataset has generic features with no typed dimension
   * (the parent owns the logic for determining this, e.g. via SLICE_TYPE_NULL).
   * When true, options are loaded directly from the dataset's features.
   */
  isDatasetSpecificSlice?: boolean;

  /**
   * Set to true when the dataset_id doesn't resolve to a known dataset.
   * Renders a read-only fallback showing the current value.
   */
  isUnknownDataset?: boolean;

  /**
   * The dataset to constrain options against. Required when
   * `isDatasetSpecificSlice` is true.
   */
  dataset_id?: string | null;

  /**
   * The currently selected data type. Used to mark options as
   * disabled when they are incompatible.
   */
  dataType?: string | null;

  /** The current selection. */
  value: SliceSelection | null;

  /** Called with the raw selection. The caller maps this to whatever
   *  output shape they need (DataExplorerContextV2, SliceQuery, etc). */
  onChange: (selection: SliceSelection | null) => void;

  /** Label displayed above the select (e.g., "Feature", "Sample"). */
  label?: string;

  /** Placeholder text when nothing is selected. */
  placeholder?: string;

  /** Whether parent data is still loading. */
  isLoading?: boolean;

  /** Colored bar on the left edge of the select. */
  swatchColor?: string;

  /** Additional className passed through to the underlying select. */
  selectClassName?: string;

  menuPortalTarget?: HTMLElement | null;
}
