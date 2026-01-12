import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { DataExplorerContextV2, SliceQuery } from "@depmap/types";
import renderConditionally from "../../../../utils/render-conditionally";
import AnnotationSelect from "../../../AnnotationSelect";
import checkPlottable from "./checkPlottable";
import styles from "../../styles/ConfigurationPanel.scss";

interface Props {
  dimension_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
  onConvertToColorContext: (context: DataExplorerContextV2) => void;
}

function ColorByAnnotationSelect({
  dimension_type,
  value,
  onChange,
  onConvertToColorContext,
}: Props) {
  const [tempPartialValue, setTempPartialValue] = useState<Partial<SliceQuery>>(
    value || { identifier_type: "column" }
  );

  useEffect(() => {
    if (!tempPartialValue.dataset_id) {
      (async () => {
        const datasets = await cached(breadboxAPI).getDatasets();
        const dimTypes = await cached(breadboxAPI).getDimensionTypes();

        const dimType = dimTypes.find((t) => t.name === dimension_type);
        const metadataDataset = datasets.find(
          (d) => d.id === dimType?.metadata_dataset_id
        );

        const dataset_id =
          metadataDataset?.given_id ||
          metadataDataset?.id ||
          `${dimension_type}_metadata`;
        setTempPartialValue((prev) => ({ ...prev, dataset_id }));
      })();
    }
  }, [dimension_type, tempPartialValue.dataset_id]);

  useEffect(() => {
    if (value) {
      setTempPartialValue(value);
    }
  }, [value]);

  return (
    <AnnotationSelect
      className={styles.ColorByAnnotationSelect}
      isClearable
      dimension_type={dimension_type}
      dataset_id={tempPartialValue.dataset_id || null}
      identifier={tempPartialValue.identifier || null}
      identifierDisplayLabel={null}
      onChangeSourceDataset={(dataset_id, identifier_type) => {
        onChange(null);
        setTempPartialValue({ dataset_id, identifier_type });
      }}
      onChangeAnnotationSlice={async (identifier: string | null) => {
        if (!identifier) {
          onChange(null);
          setTempPartialValue((prev) => ({
            ...prev,
            identifier: undefined,
          }));
          return;
        }

        const prevTpv = tempPartialValue;
        const nextValue = { ...prevTpv, identifier } as SliceQuery;
        setTempPartialValue(nextValue);

        const isPlottable = await checkPlottable({
          sliceQuery: nextValue,
          dimension_type,
          onConvertToColorContext,
        });

        if (isPlottable) {
          onChange(nextValue);
        } else {
          setTempPartialValue(prevTpv);
        }
      }}
    />
  );
}

export default renderConditionally(ColorByAnnotationSelect);
