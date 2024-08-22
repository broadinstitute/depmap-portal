import React from "react";
import CellLinePageHeader from "./CellLinePageHeader";
import CellLinePageTabs from "./CellLinePageTabs";
import styles from "../styles/CellLinePage.scss";

interface Props {
  strippedCellLineName?: string;
  publicComments?: string;
  modelId: string;
  hasMetMapData: boolean;
}

const CellLinePage = ({
  strippedCellLineName = undefined,
  publicComments = undefined,
  modelId,
  hasMetMapData,
}: Props) => {
  return (
    <div className={styles.CellLinePage}>
      <CellLinePageHeader
        strippedCellLineName={strippedCellLineName || null}
        publicComments={publicComments || null}
        modelId={modelId}
      />
      <CellLinePageTabs modelId={modelId} hasMetMapData={hasMetMapData} />
    </div>
  );
};

export default CellLinePage;
