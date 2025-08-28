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

export const isValidSliceQuery = (
  sq?: Partial<SliceQuery> | null
): sq is SliceQuery => {
  return Boolean(sq && sq.dataset_id && sq.identifier && sq.identifier_type);
};

export const areSliceQueriesEqual = (sq1: SliceQuery, sq2: SliceQuery) => {
  if (!isValidSliceQuery(sq1) || !isValidSliceQuery(sq2)) {
    throw new Error("Invalid slice query!");
  }

  return (
    sq1.dataset_id === sq2.dataset_id &&
    sq1.identifier === sq2.identifier &&
    sq1.identifier_type === sq2.identifier_type
  );
};
