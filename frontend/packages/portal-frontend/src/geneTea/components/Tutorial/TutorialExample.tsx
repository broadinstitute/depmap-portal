import React, { useRef } from "react";

import styles from "../../styles/GeneTea.scss";

interface Props {
  imgSrc: string;
  title: string;
  geneList: string[];
  description: React.ReactNode;
}

function TutorialExample({ imgSrc, title, description, geneList }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  console.log(geneList);
  const handleClick = async () => {};

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
