export type SliceQuery = {
  dataset_id: string;
  identifier: string;
  identifier_type:
    | "feature_id"
    | "feature_label"
    | "sample_id"
    | "sample_label"
    | "column";
  reindex_through?: SliceQuery;
};

export const isValidSliceQuery = (
  sq?: Partial<SliceQuery> | null
): sq is SliceQuery => {
  if (!sq || !sq.dataset_id || !sq.identifier || !sq.identifier_type) {
    return false;
  }

  if (sq.reindex_through !== undefined) {
    return isValidSliceQuery(sq.reindex_through);
  }

  return true;
};

export const areSliceQueriesEqual = (
  sq1: SliceQuery,
  sq2: SliceQuery
): boolean => {
  if (!isValidSliceQuery(sq1) || !isValidSliceQuery(sq2)) {
    throw new Error("Invalid slice query!");
  }

  if (
    sq1.dataset_id !== sq2.dataset_id ||
    sq1.identifier !== sq2.identifier ||
    sq1.identifier_type !== sq2.identifier_type
  ) {
    return false;
  }

  const has1 = sq1.reindex_through !== undefined;
  const has2 = sq2.reindex_through !== undefined;

  if (has1 !== has2) {
    return false;
  }

  if (has1 && has2) {
    return areSliceQueriesEqual(sq1.reindex_through!, sq2.reindex_through!);
  }

  return true;
};
