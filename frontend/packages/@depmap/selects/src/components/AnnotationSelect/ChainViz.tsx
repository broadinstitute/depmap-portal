/* eslint-disable prefer-arrow-callback */
import React from "react";
import { ChevronRight } from "./icons";
import styles from "../../styles/AnnotationSelect.scss";

const ChainViz = React.memo(function ChainViz({ nodes }: { nodes: string[] }) {
  return (
    <div className={styles.chainViz}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className={styles.chainArrow}>
              <ChevronRight size={10} />
            </span>
          )}
          <span className={styles.chainNode}>{node}</span>
        </React.Fragment>
      ))}
    </div>
  );
});

export default ChainViz;
