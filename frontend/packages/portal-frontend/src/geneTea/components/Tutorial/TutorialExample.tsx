import React, { useCallback, useRef } from "react";

import styles from "../../styles/GeneTea.scss";
import { useGeneTeaFiltersContext } from "src/geneTea/context/GeneTeaFiltersContext";

interface Props {
  imgSrc: string;
  title: string;
  geneList: string[];
  description: React.ReactNode;
}

function TutorialExample({ imgSrc, title, description, geneList }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { handleSetGeneSymbolSelections } = useGeneTeaFiltersContext();

  const handleClick = useCallback(async () => {
    handleSetGeneSymbolSelections(geneList);
  }, [geneList, handleSetGeneSymbolSelections]);

  return (
    <div ref={ref} className={styles.TutorialExample}>
      <span>
        <figure>
          <button type="button" tabIndex={-1} onClick={handleClick}>
            <img src={imgSrc} alt="" />
          </button>
        </figure>
        <dt>
          <button type="button" onClick={handleClick}>
            {title}
          </button>
        </dt>
      </span>
      <dd>{description}</dd>
    </div>
  );
}

export default TutorialExample;
