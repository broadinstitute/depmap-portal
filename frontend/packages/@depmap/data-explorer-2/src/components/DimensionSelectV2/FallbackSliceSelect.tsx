import React from "react";
import { DataExplorerContextV2 } from "@depmap/types";
import PlotConfigSelect from "../PlotConfigSelect";
import renderConditionally from "../../utils/render-conditionally";
import { useLabel } from "./SliceSelect/hooks";
import { getIdentifier } from "./SliceSelect/utils";

interface Props {
  index_type: string | null;
  value: DataExplorerContextV2 | undefined;
}

function FallbackSliceSelect({ index_type, value }: Props) {
  const label = useLabel(index_type);

  const displayValue = !value
    ? null
    : { value: getIdentifier(value) as string, label: value.name };

  return (
    <PlotConfigSelect
      show
      enable
      isClearable
      // TODO: Handle when user tries to clear this.
      onChange={() => {}}
      label={label}
      value={displayValue}
      options={displayValue ? [displayValue] : []}
    />
  );
}

export default renderConditionally(FallbackSliceSelect);
