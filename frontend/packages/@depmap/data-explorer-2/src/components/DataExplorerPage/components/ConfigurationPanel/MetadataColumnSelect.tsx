import React, { useCallback, useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { getConfirmation } from "@depmap/common-components";
import { DepMap } from "@depmap/globals";
import {
  AnnotationType,
  DataExplorerContextV2,
  SliceQuery,
  TabularDataset,
} from "@depmap/types";
import renderConditionally from "../../../../utils/render-conditionally";
import { fetchMetadataAndOtherTabularDatasets } from "../../../../utils/api-helpers";
import PlotConfigSelect from "../../../PlotConfigSelect";

interface Props {
  slice_type: string;
  value: SliceQuery | null;
  onChange: (nextValue: SliceQuery | null) => void;
  onConvertToColorContext: (context: DataExplorerContextV2) => void;
}

function MetadataColumnSelect({
  slice_type,
  value,
  onChange,
  onConvertToColorContext,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const [metadataDataset, setMetadataDataset] = useState<
    TabularDataset | undefined
  >();

  useEffect(() => {
    (async () => {
      const acceptedColTypes = [
        "categorical" as AnnotationType,
        "text" as AnnotationType,
      ];

      setIsLoading(true);

      const {
        metadataDataset: mdd,
      } = await fetchMetadataAndOtherTabularDatasets(
        slice_type,
        acceptedColTypes
      );

      setMetadataDataset(mdd);
      setIsLoading(false);

      if (!mdd) {
        window.console.warn(
          `No metadata for index_type "${slice_type}"`,
          `and col_type(s) "${acceptedColTypes}" found!`
        );
      }
    })();
  }, [slice_type]);

  const options = Object.keys(metadataDataset?.columns_metadata || {}).map(
    (key) => ({
      label: key,
      value: key,
    })
  );

  const checkPlottable = useCallback(
    async (slice: SliceQuery) => {
      const wrapper = await cached(breadboxAPI).getTabularDatasetData(
        slice.dataset_id,
        {
          columns: [slice.identifier],
        }
      );
      const indexedData = wrapper[slice.identifier];
      const numDistinct = new Set(Object.values(indexedData)).size;

      if (numDistinct <= 100) {
        return;
      }

      const confirmed = await getConfirmation({
        title: "Too many categorical colors",
        message: (
          <div>
            <p>
              This annotation has too many distinct values. It can’t be used to
              color the plot because it would be impossible to assign a unique
              color to each one.
            </p>
            <p>
              Do you want to use it to create a context to color by instead?
            </p>
          </div>
        ),
        yesText: "Create context",
        noText: "Cancel",
        yesButtonBsStyle: "primary",
      });

      if (!confirmed) {
        onChange(null);
        return;
      }

      DepMap.saveNewContext(
        {
          name: `${slice.identifier} list`,
          dimension_type: slice_type,
          expr: { in: [{ var: "0" }, []] },
          vars: { 0: { ...slice, source: "metadata_column" } },
        },
        null,
        onConvertToColorContext
      );
    },
    [slice_type, onChange, onConvertToColorContext]
  );

  return (
    <PlotConfigSelect
      show
      isClearable
      enable={!isLoading}
      isLoading={isLoading}
      placeholder="Choose annotation…"
      value={value?.identifier || null}
      options={options}
      onChange={(identifier) => {
        const nextValue =
          identifier && metadataDataset
            ? {
                dataset_id: metadataDataset.id,
                identifier_type: "column" as const,
                identifier,
              }
            : null;

        onChange(nextValue);

        if (nextValue) {
          checkPlottable(nextValue);
        }
      }}
    />
  );
}

export default renderConditionally(MetadataColumnSelect);
