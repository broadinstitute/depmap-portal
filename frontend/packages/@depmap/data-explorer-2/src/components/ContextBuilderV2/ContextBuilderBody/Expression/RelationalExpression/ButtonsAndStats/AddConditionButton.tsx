import React from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import { MAX_CONDITIONS } from "../../../../utils/expressionUtils";
import { scrollLastConditionIntoView } from "../../../../utils/domUtils";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  numConditions: number;
  path: (string | number)[];
}

function AddConditionButton({ path, numConditions }: Props) {
  const { dispatch } = useContextBuilderState();

  return (
    <Tooltip
      id="add-condition-tooltip"
      content="Add sub-condition"
      placement="top"
    >
      <Button
        id="add-condition"
        style={{ marginLeft: 6, height: 38 }}
        disabled={numConditions >= MAX_CONDITIONS}
        onClick={() => {
          if (path.length < 3) {
            dispatch({ type: "convert-to-group", payload: { path } });
          } else {
            dispatch({
              type: "add-condition",
              payload: { path: path.slice(0, -1) },
            });
          }

          scrollLastConditionIntoView(path);
        }}
      >
        <i className="glyphicon glyphicon-plus" />
      </Button>
    </Tooltip>
  );
}

export default AddConditionButton;
