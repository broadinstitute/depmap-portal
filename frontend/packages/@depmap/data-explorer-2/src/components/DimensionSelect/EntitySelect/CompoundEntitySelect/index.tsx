import React, { useEffect, useState } from "react";
import { DataExplorerContext } from "@depmap/types";
import CompoundNameSelect from "./CompoundNameSelect";
import CompoundExperimentSelect from "./CompoundExperimentSelect";
import { extractCompoundName } from "./utils";

interface Props {
  value: DataExplorerContext | null;
  onChange: (
    entity_label: string | null,
    inferredDataset: string | null
  ) => void;
  dataset_id: string | null;
  swatchColor?: string;
}

function CompoundEntitySelect({
  value,
  onChange,
  dataset_id,
  swatchColor = undefined,
}: Props) {
  const [compoundName, setCompoundName] = useState<string | null>(() => {
    return extractCompoundName(value?.name);
  });

  useEffect(() => {
    setCompoundName(extractCompoundName(value?.name));
  }, [value]);

  const handleChangeCompoundName = (name: string | null) => {
    onChange(null, null);
    setCompoundName(name);
  };

  return (
    <div>
      <CompoundNameSelect
        value={compoundName}
        onChangeCompoundName={handleChangeCompoundName}
        onChange={onChange}
        swatchColor={swatchColor}
        isColorSelector={Boolean(swatchColor)}
        dataset_id={dataset_id}
      />
      <CompoundExperimentSelect
        show={Boolean(compoundName && !swatchColor)}
        compoundName={compoundName}
        entity_label={value?.name || null}
        dataset_id={dataset_id}
        onChange={onChange}
        isColorSelector={Boolean(swatchColor)}
      />
    </div>
  );
}

export default CompoundEntitySelect;
