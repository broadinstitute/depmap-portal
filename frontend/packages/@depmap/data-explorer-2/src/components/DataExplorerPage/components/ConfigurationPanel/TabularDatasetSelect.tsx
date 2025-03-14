import React, { useEffect, useState } from "react";
import { AnnotationType, SliceQuery, TabularDataset } from "@depmap/types";
import { useDataExplorerApi } from "../../../../contexts/DataExplorerApiContext";
import renderConditionally from "../../../../utils/render-conditionally";
import { fetchMetadataAndOtherTabularDatasets } from "../../../../utils/api-helpers";
import PlotConfigSelect from "../../../PlotConfigSelect";

interface Props {
  slice_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
}

function TabularDatasetSelect({ slice_type, value, onChange }: Props) {
  const api = useDataExplorerApi();
  const [isLoading, setIsLoading] = useState(false);
  const [tabularDatasets, setTabularDatasets] = useState<TabularDataset[]>([]);
  const [datasetId, setDatasetId] = useState<string | null>(
    value?.dataset_id || null
  );

  useEffect(() => {
    (async () => {
      const acceptedColTypes = ["categorical" as AnnotationType];

      setIsLoading(true);

      const {
        otherTabularDatasets,
      } = await fetchMetadataAndOtherTabularDatasets(
        api,
        slice_type,
        acceptedColTypes
      );

      setTabularDatasets(otherTabularDatasets);
      setIsLoading(false);
    })();
  }, [api, slice_type]);

  const dataset =
    tabularDatasets && datasetId
      ? tabularDatasets.find((d) => d.id === datasetId)
      : null;

  const columnOptions = dataset
    ? Object.entries(dataset.columns_metadata)
        .filter(([, metadata]) =>
          // TODO: add support for type "list_strings"
          ["text", "categorical"].includes(metadata.col_type)
        )
        .map(([column, metadata]) => ({
          label: column,
          value: column,
          col_type: metadata.col_type,
        }))
    : [];

  return (
    <div>
      <PlotConfigSelect
        show
        isClearable
        enable={!isLoading}
        isLoading={isLoading}
        value={datasetId || null}
        options={tabularDatasets.map((td) => ({
          label: td.name,
          value: td.given_id || td.id,
        }))}
        onChange={(dataset_id) => {
          setDatasetId(dataset_id);

          if (!dataset_id) {
            onChange(null);
          }
        }}
        placeholder="Choose dataset…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
      <PlotConfigSelect
        show
        enable={Boolean(datasetId)}
        value={value?.identifier || null}
        options={columnOptions}
        onChange={(identifier) => {
          onChange(
            identifier && datasetId
              ? {
                  dataset_id: datasetId,
                  identifier_type: "column",
                  identifier,
                }
              : null
          );
        }}
        placeholder="Choose column…"
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </div>
  );
}

export default renderConditionally(TabularDatasetSelect);
