import React from "react";
import { RelationExpr } from "../../../../utils/expressionUtils";
import AddConditionButton from "./AddConditionButton";
import DeleteConditionButton from "./DeleteConditionButton";
import NumberOfMatches from "../../NumberOfMatches";
import styles from "../../../../../../styles/ContextBuilderV2.scss";

interface Props {
  expr: RelationExpr;
  path: (string | number)[];
  varName: string | null;
  isLastOfList: boolean;
}

function ButtonsAndStats({ expr, path, varName, isLastOfList }: Props) {
  const numConditions = Number(path.slice().pop()) + 1;

  // TODO: Add a button similar to "Edit in Cell Line Selector" that opens a
  // new metadata viewer.
  return (
    <div className={styles.ButtonsAndStats}>
      <div>
        {path.length > 0 && (
          <DeleteConditionButton path={path} varName={varName} />
        )}
        {path.length > 0 && (path.length < 3 || isLastOfList) && (
          <AddConditionButton path={path} numConditions={numConditions} />
        )}
      </div>
      <NumberOfMatches className={styles.singleExprMatches} expr={expr} />
    </div>
  );
}

export default ButtonsAndStats;