import { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { AnnotationType, Dataset, TabularDataset } from "@depmap/types";

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

export function useAnnotationDatasets(dimension_type: string) {
  const [axis, setAxis] = useState<"sample" | "feature">();
  const [metadataDataset, setMetadataDataset] = useState<TabularDataset>();
  const [metadataIdColumn, setMetadataIdColumn] = useState<string | undefined>(
    undefined
  );
  const [annotationDatasets, setAnnotationDatasets] = useState<Dataset[]>([]);
  const [
    isLoadingAnnotationDatasets,
    setIsLoadingAnnotationDatasets,
  ] = useState(true);

  useEffect(() => {
    (async () => {
      // prefetch all data
      cached(breadboxAPI).getDatasets();
      cached(breadboxAPI).getDimensionType(dimension_type);
      fetchMetadataAndOtherTabularDatasets(dimension_type);

      const dType = await cached(breadboxAPI).getDimensionType(dimension_type);
      setAxis(dType.axis);

      const {
        metadataDataset: metaDs,
        metadataIdColumn: metaIdCol,
      } = await fetchMetadataAndOtherTabularDatasets(dimension_type);

      setMetadataDataset(metaDs);
      setMetadataIdColumn(metaIdCol);

      const datasets = await cached(breadboxAPI)
        .getDatasets()
        .then((allDatasets) =>
          allDatasets
            .filter((d) => {
              const dimType =
                d.format === "matrix_dataset"
                  ? d[`${dType.axis}_type_name`]
                  : d.index_type_name;

              return (
                d.id !== metaDs?.id &&
                dimType === dimension_type &&
                ["Annotations", "metadata"].includes(d.data_type)
              );
            })
            .sort((a, b) => {
              return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
            })
        );

      setAnnotationDatasets(datasets);
      setIsLoadingAnnotationDatasets(false);
    })();
  }, [dimension_type]);

  return {
    axis,
    metadataDataset,
    metadataIdColumn,
    annotationDatasets,
    isLoadingAnnotationDatasets,
  };
}
