export type SliceQuery = {
  dataset_id: string;
  identifier: string;
  identifier_type:
    | "feature_id"
    | "feature_label"
    | "sample_id"
    | "sample_label"
    | "column";
};

export type SliceQueryAssociations = SliceQuery & {
  association_datasets?: string[];
};

export const isValidSliceQuery = (
  sq?: Partial<SliceQuery> | null
): sq is SliceQuery => {
  return Boolean(sq && sq.dataset_id && sq.identifier && sq.identifier_type);
};
