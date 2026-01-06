import React from "react";
import { ContextSelectorV2 } from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  context_type: string;
  value: DataExplorerContextV2 | null;
  onChange: (nextContext: DataExplorerContextV2 | null) => void;
}

function AnalysisFilterSelect({ context_type, value, onChange }: Props) {
  const handleClickCreateContext = () => {
    DepMap.saveNewContext({ context_type }, null, onChange);
  };

  const handleClickSaveAsContext = () => {
    DepMap.saveNewContext(value, null, setValue);
  };

  return (
    <div className={styles.AnalysisContextSelectContainer}>
      <ContextSelectorV2
        show
        enable
        value={value}
        onChange={onChange}
        context_type={context_type}
        onClickCreateContext={handleClickCreateContext}
        onClickSaveAsContext={handleClickSaveAsContext}
        selectClassName={styles.AnalysisContextSelect}
      />
    </div>
  );
}

export default AnalysisFilterSelect;
