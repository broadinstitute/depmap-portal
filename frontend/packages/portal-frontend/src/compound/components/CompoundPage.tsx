import React from "react";
import CompoundPageHeader from "./CompoundPageHeader";
import CompoundPageTabs from "./CompoundPageTabs";
import styles from "../styles/CompoundPage.scss";
import { TileTypeEnum } from "./CompoundPageOverview";

interface Props {
  /* props */
}

const CompoundPage = ({}: /* props */ Props) => {
  return (
    <div className={styles.CompoundPage}>
      <CompoundPageHeader
      /* props */
      />
      <CompoundPageTabs
      /* props */
      />
    </div>
  );
};

export default GenePage;
