import { AnnotationType, TabularDataset } from "@depmap/types";
import { breadboxAPI, cached } from "@depmap/api";

export async function fetchMetadataAndOtherTabularDatasets(
  dimension_type: string,
  acceptedColTypes?: (keyof typeof AnnotationType)[]
) {
  const [types, datasets] = await Promise.all([
    cached(breadboxAPI).getDimensionTypes(),
    cached(breadboxAPI).getDatasets(),
  ]);

  const dimType = types.find((t) => t.name === dimension_type);

  const allTabularDatasets = datasets.filter(
    (d) =>
      d.format === "tabular_dataset" && d.index_type_name === dimension_type
  ) as TabularDataset[];

  const metadataDataset = allTabularDatasets.find((d) => {
    return (
      dimType?.metadata_dataset_id &&
      d.id === dimType.metadata_dataset_id &&
      Object.values(d.columns_metadata).some((cm) => {
        return !acceptedColTypes || acceptedColTypes.includes(cm.col_type);
      })
    );
  });

  const metadataIdColumn = dimType?.id_column;

  const otherTabularDatasets = allTabularDatasets
    .filter((d) => {
      return (
        !dimType ||
        !dimType.metadata_dataset_id ||
        d.id !== dimType.metadata_dataset_id
      );
    })
    .filter((d) => {
      return Object.values(d.columns_metadata).some((cm) => {
        return !acceptedColTypes || acceptedColTypes.includes(cm.col_type);
      });
    });

  return { metadataDataset, metadataIdColumn, otherTabularDatasets };
}
