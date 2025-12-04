import React from "react";
import { showInfoModal } from "@depmap/common-components";
import type { SliceQuery } from "@depmap/types";
import SlicePreview from "./SlicePreview";

interface Props {
  index_type_name: string;
  PlotlyLoader: any;
  sliceQuery: SliceQuery;
  rowSelection?: Record<string, boolean>;
}

function showDataSlicePreview({
  index_type_name,
  PlotlyLoader,
  sliceQuery,
  rowSelection,
}: Props) {
  showInfoModal({
    title: "View column",
    content: (
      <SlicePreview
        value={sliceQuery}
        index_type_name={index_type_name}
        PlotlyLoader={PlotlyLoader}
        rowSelection={rowSelection}
      />
    ),
  });
}

export default showDataSlicePreview;
