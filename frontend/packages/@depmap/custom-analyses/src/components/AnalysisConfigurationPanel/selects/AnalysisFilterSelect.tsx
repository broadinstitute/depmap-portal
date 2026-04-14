import React from "react";
import { ContextSelectorV2 } from "@depmap/data-explorer-2";
import { DepMap } from "@depmap/globals";
import { DataExplorerContextV2 } from "@depmap/types";
import styles from "../../../styles/CustomAnalysesPage.scss";

interface Props {
  dimension_type: string;
  value: DataExplorerContextV2 | null;
  onChange: (nextContext: DataExplorerContextV2 | null) => void;
}

function AnalysisFilterSelect({ dimension_type, value, onChange }: Props) {
  const handleClickCreateContext = () => {
    DepMap.saveNewContext({ dimension_type }, null, onChange);
  };

  const handleClickSaveAsContext = () => {
    DepMap.saveNewContext(value || { dimension_type }, null, onChange);
  };

  return (
    <div className={styles.AnalysisContextSelectContainer}>
      <ContextSelectorV2
        show
        enable
        value={value}
        onChange={onChange}
        dimension_type={dimension_type}
        onClickCreateContext={handleClickCreateContext}
        onClickSaveAsContext={handleClickSaveAsContext}
        selectClassName={styles.AnalysisContextSelect}
        linkToContextManager
      />
    </div>
  );
}

export default AnalysisFilterSelect;
